import { GoogleGenAI, GenerateContentResponse, Type, Modality, Content, Part, GroundingChunk } from "@google/genai";
import { ChatMode, AspectRatio, GroundingSource, VideoAspectRatio } from '../types';

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("La variable de entorno API_KEY no está configurada");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
): Promise<{ text: string, sources: GroundingSource[] }> => {
    const ai = getAi();
    let modelName: string;
    let config: any = {};
    let toolConfig: any = {};

    switch (mode) {
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
        case ChatMode.STANDARD:
        default:
            modelName = 'gemini-2.5-flash';
            break;
    }

    // Forzar gemini-2.5-pro si se detectan fotogramas de video para un mejor análisis
    const hasVideoFrames = mediaParts && mediaParts.length > 1 && mediaParts.every(p => p.inlineData?.mimeType === 'image/jpeg');
    if (hasVideoFrames) {
        modelName = 'gemini-2.5-pro';
    }

    const userMessageContent: { parts: Part[] } = { parts: [{ text: prompt }] };
    if (mediaParts) {
        userMessageContent.parts.push(...mediaParts);
    }

    const chat = ai.chats.create({ model: modelName, history, config, toolConfig });
    const response = await chat.sendMessage(userMessageContent);
    
    const text = response.text;
    const sources = extractSources(response.candidates?.[0]?.groundingMetadata?.groundingChunks);

    return { text, sources };
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
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};


export const editImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAi();
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: { responseModalities: [Modality.IMAGE] },
    });
    
    const part = response.candidates?.[0]?.content?.parts[0];
    if (part && part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
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
    return response.text;
};

export const generateSpeech = async (text: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
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
    // Crea una nueva instancia para Veo para asegurar que se use la clave de API más reciente
    if (!process.env.API_KEY) {
        throw new Error("La variable de entorno API_KEY no está configurada");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let operation = await ai.models.generateVideos({
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

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Sondear cada 10 segundos
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("No se pudo obtener el enlace de descarga del video.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Error al descargar video:", errorBody);
        throw new Error(`Error al descargar el video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};