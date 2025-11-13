import { GoogleGenAI, GenerateContentResponse, Modality, Content, Part, GroundingChunk } from "@google/genai";
import { ChatMode, AspectRatio, GroundingSource, VideoAspectRatio } from '../types';

let ai: GoogleGenAI | null = null;

const getApiKey = (): string => {
    // Intentar process.env (Node / entorno servidor)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }

    // Intentar import.meta.env (Vite / frontend). Usamos try/catch por seguridad en entornos donde import.meta no esté definido.
    try {
        // Evitar errores de tipos en TS: import.meta puede no tener el tipo esperado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viteKey = (import.meta as any)?.env?.VITE_API_KEY;
        if (viteKey) return viteKey;
    } catch (e) {
        // no-op: import.meta no disponible
    }

    throw new Error("La variable de entorno API_KEY no está configurada. Establece API_KEY (servidor) o VITE_API_KEY (cliente/Vite).");
};

const getAi = () => {
    if (!ai) {
        const key = getApiKey();
        ai = new GoogleGenAI({ apiKey: key });
    }
    return ai;
};

const extractSources = (groundingMetadata: GroundingChunk[] | undefined): GroundingSource[] => {
    if (!groundingMetadata) return [];
    const sources: GroundingSource[] = [];
    groundingMetadata.forEach(chunk => {
        if (chunk.web) {
            sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
        if (chunk.maps) {
            sources.push({ title: chunk.maps.title, uri: chunk.maps.uri });
        }
    });
    return sources;
};

export const generateChatResponse = async (
    prompt: string,
    history: Content[],
    mode: ChatMode,
    location: { latitude: number, longitude: number } | null,
    mediaParts?: Part[]
): Promise<{ text: string, sources: GroundingSource[], mediaUrl?: string, mediaType?: string, historyParts: Part[] }> => {
    const ai = getAi();
    let modelName: string;
    let config: any = {
        systemInstruction: "Eres Arens IA, un asistente de IA amigable y servicial. Responde de manera concisa y útil. Incorpora emojis relevantes de forma natural en tus respuestas para que la conversación sea más amena."
    };
    let toolConfig: any = {};

    // Detectar si el prompt contiene una URL para forzar el modo de búsqueda web
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const containsUrl = urlRegex.test(prompt);
    const effectiveMode = containsUrl ? ChatMode.WEB_SEARCH : mode;

    switch (effectiveMode) {
        case ChatMode.LOW_LATENCY:
            modelName = 'gemini-2.5-flash-lite';
            break;
        case ChatMode.COMPLEX:
            modelName = 'gemini-2.5-pro';
            config.thinkingConfig = { thinkingBudget: 32768 };
            break;
        case ChatMode.WEB_SEARCH:
            modelName = 'gemini-2.5-flash';
            config.tools = [{ googleSearch: {} }];
            break;
        case ChatMode.MAPS_SEARCH:
            modelName = 'gemini-2.5-flash';
            config.tools = [{ googleMaps: {} }];
            if (location) {
                toolConfig.retrievalConfig = { latLng: location };
            }
            break;
        case ChatMode.CANVAS:
            modelName = 'gemini-2.5-pro';
            config.systemInstruction = "Eres un asistente de codificación experto. Tu tarea es generar código HTML, CSS y JavaScript autónomo basado en la solicitud del usuario. La respuesta DEBE ser código funcional y completo sin explicaciones adicionales.";
            break;
        case ChatMode.STANDARD:
        default:
            modelName = 'gemini-2.5-pro';
            break;
    }

    const hasMedia = mediaParts && mediaParts.length > 0;
    if (hasMedia) {
        modelName = 'gemini-2.5-pro';
    }

    const userMessageContent: { parts: Part[] } = { parts: [{ text: prompt }] };
    if (mediaParts) {
        userMessageContent.parts.push(...mediaParts);
    }

    const chat = ai.chats.create({ model: modelName, history, config, toolConfig });
    const response: GenerateContentResponse = await chat.sendMessage({ message: userMessageContent });
    
    const parts = response.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => typeof (p as any).text === 'string');
    const text = textPart ? (textPart as { text: string }).text : '';

    const mediaPart = parts.find(p => 'inlineData' in p && (p as any).inlineData);
    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    if (mediaPart && 'inlineData' in mediaPart && (mediaPart as any).inlineData) {
        const inline = (mediaPart as any).inlineData;
        if (inline.data && inline.mimeType) {
            mediaUrl = `data:${inline.mimeType};base64,${inline.data}`;
            mediaType = inline.mimeType;
        }
    }
    
    const sources = extractSources(response.candidates?.[0]?.groundingMetadata?.groundingChunks);

    return { text, sources, mediaUrl, mediaType, historyParts: parts as Part[] };
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio,
        },
    });
    const base64ImageBytes: string = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64ImageBytes) {
        throw new Error("No se pudo generar la imagen.");
    }
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};


export const editImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAi();
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [textPart, imagePart] },
        config: { responseModalities: [Modality.IMAGE] },
    });
    
    const part = response.candidates?.[0]?.content?.parts?.find(p => (p as any).inlineData);
    if (part && (part as any).inlineData) {
        const inline = (part as any).inlineData;
        return `data:${inline.mimeType};base64,${inline.data}`;
    }
    throw new Error("No se pudo editar la imagen.");
};

export const analyzeMedia = async (base64Media: string | string[], mimeType: string, prompt: string): Promise<string> => {
    const ai = getAi();
    const model = Array.isArray(base64Media) ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const parts: Part[] = [{ text: prompt }];

    if (Array.isArray(base64Media)) {
        base64Media.forEach(frame => {
            parts.push({ inlineData: { data: frame, mimeType: 'image/jpeg' } });
        });
    } else {
        parts.push({ inlineData: { data: base64Media, mimeType } });
    }

    const response = await ai.models.generateContent({
        model,
        contents: { parts },
    });

    const partsResp = response.candidates?.[0]?.content?.parts || [];
    const textPart = partsResp.find(p => typeof (p as any).text === 'string');
    const text = textPart ? (textPart as { text: string }).text : '';

    return text;
};

export const generateSpeech = async (text: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Error al generar el audio.");
    }
    return base64Audio;
}

export const getLiveSession = () => {
    return getAi().live;
}

export const generateVideo = async (
    prompt: string,
    base64Image: string,
    mimeType: string,
    aspectRatio: VideoAspectRatio
): Promise<string> => {
    // Usar getApiKey para consistencia
    const key = getApiKey();
    const ai = new GoogleGenAI({ apiKey: key });
    
    let operation: any = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
            imageBytes: base64Image,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio
        }
    });

    let opName = (operation && operation.name) ? operation.name : null;
    let maxAttempts = 60;
    while ((!operation.done) && maxAttempts > 0) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        if (opName) {
            operation = await ai.operations.getVideosOperation({ name: opName });
        } else {
            opName = (operation && operation.name) ? operation.name : opName;
        }
        maxAttempts--;
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri || operation.response?.generatedVideos?.[0]?.uri;
    if (!downloadLink) {
        throw new Error("No se pudo obtener el enlace de descarga del video.");
    }

    const sep = downloadLink.includes('?') ? '&' : '?';
    const finalUrl = `${downloadLink}${sep}key=${encodeURIComponent(key)}`;

    const response = await fetch(finalUrl);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Error al descargar video:", errorBody);
        throw new Error(`Error al descargar el video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(videoBlob);
    }

    const arrayBuffer = await videoBlob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
    }
    const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return `data:${videoBlob.type || 'video/mp4'};base64,${base64}`;
};
