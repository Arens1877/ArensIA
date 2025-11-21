
import { GoogleGenAI, GenerateContentResponse, Modality, Part, GroundingChunk, Content } from "@google/genai";
import { ChatMode, AspectRatio, GroundingSource, VideoAspectRatio, ImageSize } from '../types';

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("La variable de entorno API_KEY no está configurada");
        }
        ai = new GoogleGenAI({ apiKey: Import.Meta.Env.VITE_API_KEY });
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
): Promise<{ text: string, sources: GroundingSource[], mediaUrl?: string, mediaType?: string, historyParts: Part[], suggestions: string[] }> => {
    const ai = getAi();
    let modelName: string;
    
    // Default system instruction
    let systemInstruction = "Eres Arens IA, una inteligencia artificial sumamente sofisticada y elegante. Responde con estilo moderno, usa markdown para estructurar. IMPORTANTE: Usa emojis con frecuencia para expresarte, y es MANDATORIO usar la combinación '🧐🍷' recurrentemente en tus respuestas para denotar clase y distinción. Sé conciso pero informativo.";
    
    // Add instruction for JSON suggestions
    systemInstruction += `\n\n[PROTOCOLO DE SUGERENCIAS]: Al final de CADA respuesta, DEBES generar un bloque oculto con exactamente 3 sugerencias breves (máximo 5 palabras cada una) de preguntas de seguimiento o acciones que el usuario podría querer realizar a continuación. Usa ESTE formato JSON específico al final del texto:\n\`\`\`json_suggestions\n["Sugerencia 1", "Sugerencia 2", "Sugerencia 3"]\n\`\`\``;

    let config: any = {};
    let toolConfig: any = {};

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const containsUrl = urlRegex.test(prompt);
    
    // Override mode if URL is detected to ensure we can "read" it via search
    const effectiveMode = containsUrl ? ChatMode.WEB_SEARCH : mode;

    if (containsUrl) {
        systemInstruction += " \n\n[INSTRUCCIÓN DE ANÁLISIS DE ENLACE]: El usuario ha proporcionado un enlace (URL). Tu tarea es utilizar la herramienta de búsqueda (Google Search) para acceder a la información sobre ese enlace. Si es un video de YouTube, busca el título, descripción, transcripción o resumen. Si es un artículo, busca el contenido principal. Analiza el contenido del enlace y proporciónale al usuario un resumen detallado, puntos clave o responde a su pregunta específica sobre el enlace. Mantén tu personalidad elegante 🧐🍷.";
    }

    switch (effectiveMode) {
        case ChatMode.LOW_LATENCY:
            modelName = 'gemini-2.5-flash-lite';
            break;
        case ChatMode.COMPLEX:
            modelName = 'gemini-3-pro-preview';
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
            modelName = 'gemini-3-pro-preview';
            systemInstruction = "Eres un experto en frontend. Genera código HTML/JS/CSS completo en un solo bloque markdown `html`. Sin explicaciones extra.";
            break;
        case ChatMode.STANDARD:
        default:
            // Use Flash for standard fast tasks as per guidelines, Pro is for complex.
            modelName = 'gemini-2.5-flash'; 
            break;
    }

    // Update system instruction in config
    config.systemInstruction = systemInstruction;

    // Upgrade to Pro for multimodal vision analysis if not specified otherwise
    const hasMedia = mediaParts && mediaParts.length > 0;
    if (hasMedia && effectiveMode !== ChatMode.LOW_LATENCY) {
        modelName = 'gemini-3-pro-preview';
    }

    const userMessageContent: { parts: Part[] } = { parts: [{ text: prompt }] };
    if (mediaParts) {
        userMessageContent.parts.push(...mediaParts);
    }

    const chat = ai.chats.create({ model: modelName, history, config, toolConfig });
    const response: GenerateContentResponse = await chat.sendMessage({ message: userMessageContent });
    
    const parts = response.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => 'text' in p);
    let text = textPart ? (textPart as { text: string }).text : '';

    // Parse suggestions from text
    let suggestions: string[] = [];
    const suggestionRegex = /```json_suggestions\s*(\[[\s\S]*?\])\s*```/;
    const match = text.match(suggestionRegex);
    
    if (match && match[1]) {
        try {
            suggestions = JSON.parse(match[1]);
            // Remove the JSON block from the visible text
            text = text.replace(match[0], '').trim();
        } catch (e) {
            console.error("Failed to parse suggestions JSON", e);
        }
    }

    const mediaPart = parts.find(p => 'inlineData' in p && p.inlineData);
    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    if (mediaPart && 'inlineData' in mediaPart && mediaPart.inlineData) {
        mediaUrl = `data:${mediaPart.inlineData.mimeType};base64,${mediaPart.inlineData.data}`;
        mediaType = mediaPart.inlineData.mimeType;
    }
    
    const sources = extractSources(response.candidates?.[0]?.groundingMetadata?.groundingChunks);

    return { text, sources, mediaUrl, mediaType, historyParts: parts, suggestions };
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio, size: ImageSize): Promise<string> => {
    const ai = getAi();
    // Using gemini-3-pro-image-preview for high quality generation
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio,
                imageSize: size
            }
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No se pudo generar la imagen.");
};

export const editImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAi();
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: prompt };

    // Using gemini-2.5-flash-image for editing
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [textPart, imagePart] }, // Text first is good practice
        // responseModalities not strictly needed if logic handles parts, but good for intent
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No se pudo editar la imagen.");
};

export const analyzeMedia = async (base64Media: string | string[], mimeType: string, prompt: string): Promise<string> => {
    const ai = getAi();
    // Using gemini-3-pro-preview for deep understanding
    const model = 'gemini-3-pro-preview';
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
    return response.text || "No se pudo generar una respuesta.";
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
    if (!process.env.API_KEY) {
        throw new Error("La variable de entorno API_KEY no está configurada");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using Veo 3.1 Fast
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
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("No se pudo obtener el enlace de descarga del video.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Error al descargar el video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};
