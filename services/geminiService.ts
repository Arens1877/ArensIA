import { GoogleGenAI, GenerateContentResponse, Type, Modality, Content, Part, GroundingChunk } from "@google/genai";
import { ChatMode, AspectRatio, GroundingSource, VideoAspectRatio } from "../types";

// Usa una sola fuente para la API KEY - puedes adaptar según tu bundler/build
const API_KEY = process.env.API_KEY || (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_KEY);

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        if (!API_KEY) {
            throw new Error("La variable de entorno API_KEY no está configurada");
        }
        ai = new GoogleGenAI({ apiKey: API_KEY });
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

// Corregir tipo explícito al devolver respuesta, y manejo robusto de partes nulas/vacías.
export const generateChatResponse = async (
    prompt: string,
    history: Content[],
    mode: ChatMode,
    location: { latitude: number, longitude: number } | null,
    mediaParts?: Part[]
): Promise<{ text: string, sources: GroundingSource[], mediaUrl?: string, mediaType?: string, historyParts: Part[] }> => {
    const genai = getAi();
    let modelName: string;
    let config: any = {};
    let toolConfig: any = {};

    switch (mode) {
        case ChatMode.LOW_LATENCY:
            modelName = "gemini-2.5-flash-lite";
            break;
        case ChatMode.COMPLEX:
            modelName = "gemini-2.5-pro";
            config.thinkingConfig = { thinkingBudget: 32768 };
            break;
        case ChatMode.WEB_SEARCH:
            modelName = "gemini-2.5-flash";
            config.tools = [{ googleSearch: {} }];
            break;
        case ChatMode.MAPS_SEARCH:
            modelName = "gemini-2.5-flash";
            config.tools = [{ googleMaps: {} }];
            if (location) {
                toolConfig.retrievalConfig = { latLng: location };
            }
            break;
        case ChatMode.STANDARD:
        default:
            modelName = "gemini-2.5-pro";
            break;
    }

    const hasMedia = Array.isArray(mediaParts) && mediaParts.length > 0;
    if (hasMedia) {
        modelName = "gemini-2.5-pro";
    }

    const userMessageContent: { parts: Part[] } = { parts: [{ text: prompt }] };
    if (mediaParts && mediaParts.length > 0) {
        userMessageContent.parts.push(...mediaParts);
    }

    // chat puede no ser asíncrono, pero por si acaso
    const chat = genai.chats.create({ model: modelName, history, config, toolConfig });
    const response: GenerateContentResponse = await chat.sendMessage({ message: userMessageContent });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => "text" in p) as { text: string } | undefined;
    const text = textPart?.text || "";

    const mediaPart = parts.find(p => "inlineData" in p && p.inlineData) as any;
    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    if (mediaPart && mediaPart.inlineData) {
        mediaUrl = `data:${mediaPart.inlineData.mimeType};base64,${mediaPart.inlineData.data}`;
        mediaType = mediaPart.inlineData.mimeType;
    }

    const sources = extractSources(response.candidates?.[0]?.groundingMetadata?.groundingChunks);

    return { text, sources, mediaUrl, mediaType, historyParts: parts };
};

// Agrega control de errores si falta el array o el objeto esperado
export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
    const genai = getAi();
    const response = await genai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
            aspectRatio,
        },
    });
    const base64ImageBytes: string | undefined = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64ImageBytes) throw new Error("No se pudo generar la imagen.");
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};

export const editImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const genai = getAi();
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: prompt };

    const response = await genai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [textPart, imagePart] },
        config: { responseModalities: [Modality.IMAGE] },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("No se pudo editar la imagen.");
};

export const analyzeMedia = async (base64Media: string | string[], mimeType: string, prompt: string): Promise<string> => {
    const genai = getAi();
    const model = Array.isArray(base64Media) ? "gemini-2.5-pro" : "gemini-2.5-flash";
    const parts: Part[] = [{ text: prompt }];

    if (Array.isArray(base64Media)) {
        for (const frame of base64Media) {
            parts.push({ inlineData: { data: frame, mimeType: "image/jpeg" } });
        }
    } else {
        parts.push({ inlineData: { data: base64Media, mimeType } });
    }

    const response = await genai.models.generateContent({
        model,
        contents: { parts },
    });
    return response.text || "";
};

export const generateSpeech = async (text: string): Promise<string> => {
    const genai = getAi();
    const response = await genai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Kore" },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Error al generar el audio.");
    }
    return base64Audio;
};

// Exportación robusta dependiendo de si .live existe
export const getLiveSession = () => {
    const genai = getAi();
    if (!("live" in genai)) throw new Error("Live session no soportada en esta versión o instancia.");
    // @ts-ignore
    return genai.live;
};

export const generateVideo = async (
    prompt: string,
    base64Image: string,
    mimeType: string,
    aspectRatio: VideoAspectRatio
): Promise<string> => {
    if (!API_KEY) {
        throw new Error("La variable de entorno API_KEY no está configurada");
    }
    // Siempre instancia nueva por si la API key ha cambiado en tiempo de ejecución
    const genai = new GoogleGenAI({ apiKey: API_KEY });

    let operation = await genai.models.generateVideos({
        model: "veo-3.1-fast-generate-preview",
        prompt: prompt,
        image: {
            imageBytes: base64Image,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: "720p",
            aspectRatio: aspectRatio,
        },
    });

    // La API puede requerir operation.name, ajusta si tu SDK lo exige
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await genai.operations.getVideosOperation({ name: operation.name });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("No se pudo obtener el enlace de descarga del video.");
    }

    // Atención: fetch y URL solo funcionan en browser, no en Node puro
    const response = await fetch(`${downloadLink}&key=${API_KEY}`);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Error al descargar video:", errorBody);
        throw new Error(`Error al descargar el video: ${response.statusText}`);
    }

    if (typeof window === "undefined" || typeof URL === "undefined") {
        throw new Error("URL.createObjectURL no está disponible fuera de un entorno de navegador.");
    }

    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};
