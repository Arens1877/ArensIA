
import { GoogleGenAI, GenerateContentResponse, Modality, Part, GroundingChunk, Content } from "@google/genai";
import { ChatMode, AspectRatio, GroundingSource, VideoAspectRatio, ImageSize } from '../types';

/**
 * Solicita al usuario que seleccione una clave de API si el modelo lo requiere
 * o si se ha detectado un error de permisos.
 */
const requestKeySelection = async () => {
    if (window.aistudio) {
        await window.aistudio.openSelectKey();
    }
};

const getAi = () => {
    if (!process.env.API_KEY) {
        throw new Error("Mis disculpas, pero la llave de mi sabiduría (API Key) no ha sido configurada correctamente 🧐🍷.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const handleApiError = async (e: any): Promise<string> => {
    console.error("Gemini API Error Detail:", e);
    const message = e.message || "";
    
    // Error 403: No tiene permisos (Key incorrecta o sin facturación para modelos Pro/Veo)
    if (message.includes("403") || message.toLowerCase().includes("permission_denied") || message.toLowerCase().includes("not have permission")) {
        await requestKeySelection();
        return "Parece que mi llave actual no tiene los permisos suficientes para esta tarea de alto nivel. He abierto el selector de llaves para que elija una con facturación habilitada 🧐🍷.";
    }

    if (message.includes("404") || message.toLowerCase().includes("not found")) {
        await requestKeySelection();
        return "El modelo solicitado no fue encontrado con esta llave. Por favor, seleccione una llave válida 🧐🍷.";
    }

    if (message.includes("429") || message.toLowerCase().includes("quota")) {
        return "Parece que hemos excedido el límite de refinamiento permitido por ahora. Un breve descanso sería prudente 🧐🍷.";
    }

    return `Ha ocurrido un evento inesperado: ${message || "Error desconocido"}. Intentémoslo de nuevo 🧐🍷.`;
};

const extractSources = (groundingMetadata: any): GroundingSource[] => {
    if (!groundingMetadata?.groundingChunks) return [];
    const sources: GroundingSource[] = [];
    groundingMetadata.groundingChunks.forEach((chunk: any) => {
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
    try {
        // Para modos Pro, aseguramos que haya una clave
        if (mode === ChatMode.COMPLEX || mode === ChatMode.CANVAS || (mediaParts && mediaParts.length > 0)) {
            if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
                await requestKeySelection();
            }
        }

        const ai = getAi();
        let modelName: string;
        
        let systemInstruction = "Eres Arens IA, una IA sofisticada y elegante. Responde con estilo moderno y usa markdown. Es MANDATORIO usar emojis '🧐🍷' frecuentemente. Sé conciso y distinguido.";
        systemInstruction += `\n\n[PROTOCOLO DE SUGERENCIAS]: Al final de tu respuesta, DEBES generar exactamente 3 sugerencias breves en formato JSON:\n\`\`\`json_suggestions\n["Sugerencia 1", "Sugerencia 2", "Sugerencia 3"]\n\`\`\``;

        let config: any = {};
        let toolConfig: any = {};

        switch (mode) {
            case ChatMode.LOW_LATENCY:
                modelName = 'gemini-flash-lite-latest';
                break;
            case ChatMode.LIVE_SEARCH:
                modelName = 'gemini-3-flash-preview';
                config.tools = [{ googleSearch: {} }];
                break;
            case ChatMode.COMPLEX:
                modelName = 'gemini-3-pro-preview';
                config.thinkingConfig = { thinkingBudget: 32768 };
                break;
            case ChatMode.WEB_SEARCH:
                modelName = 'gemini-3-flash-preview';
                config.tools = [{ googleSearch: {} }];
                break;
            case ChatMode.MAPS_SEARCH:
                modelName = 'gemini-2.5-flash-latest';
                config.tools = [{ googleMaps: {} }];
                if (location) {
                    toolConfig.retrievalConfig = { latLng: location };
                }
                break;
            case ChatMode.CANVAS:
                modelName = 'gemini-3-pro-preview';
                systemInstruction = "Eres un experto en frontend. Genera código HTML/JS/CSS completo en un solo bloque markdown `html`.";
                break;
            case ChatMode.STANDARD:
            default:
                modelName = 'gemini-3-flash-preview'; 
                break;
        }

        config.systemInstruction = systemInstruction;

        if (mediaParts && mediaParts.length > 0 && mode !== ChatMode.LOW_LATENCY) {
            modelName = 'gemini-3-pro-preview';
        }

        const userMessageContent: Content = { parts: [{ text: prompt }] };
        if (mediaParts) {
            userMessageContent.parts.push(...mediaParts);
        }

        const chat = ai.chats.create({ model: modelName, history, config, toolConfig });
        const response: GenerateContentResponse = await chat.sendMessage({ message: userMessageContent });
        
        let text = response.text || '';
        let suggestions: string[] = [];
        const suggestionRegex = /```json_suggestions\s*(\[[\s\S]*?\])\s*```/;
        const match = text.match(suggestionRegex);
        
        if (match && match[1]) {
            try {
                suggestions = JSON.parse(match[1]);
                text = text.replace(match[0], '').trim();
            } catch (e) { console.error("Error parseando sugerencias", e); }
        }

        const parts = response.candidates?.[0]?.content?.parts || [];
        const mediaPart = parts.find(p => 'inlineData' in p && p.inlineData);
        let mediaUrl: string | undefined = undefined;
        let mediaType: string | undefined = undefined;

        if (mediaPart && 'inlineData' in mediaPart && mediaPart.inlineData) {
            mediaUrl = `data:${mediaPart.inlineData.mimeType};base64,${mediaPart.inlineData.data}`;
            mediaType = mediaPart.inlineData.mimeType;
        }
        
        const sources = extractSources(response.candidates?.[0]?.groundingMetadata);

        return { text, sources, mediaUrl, mediaType, historyParts: parts, suggestions };
    } catch (e) {
        const errorMsg = await handleApiError(e);
        throw new Error(errorMsg);
    }
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio, size: ImageSize): Promise<string> => {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await requestKeySelection();
        }

        const ai = getAi();
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
            if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        throw new Error("No he podido materializar la imagen solicitada 🧐🍷.");
    } catch (e) {
        const errorMsg = await handleApiError(e);
        throw new Error(errorMsg);
    }
};

export const editImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }, { inlineData: { data: base64Image, mimeType } }] },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        throw new Error("La edición solicitada no pudo ser procesada 🧐🍷.");
    } catch (e) {
        const errorMsg = await handleApiError(e);
        throw new Error(errorMsg);
    }
};

export const analyzeMedia = async (base64Media: string | string[], mimeType: string, prompt: string): Promise<string> => {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await requestKeySelection();
        }
        const ai = getAi();
        const model = 'gemini-3-pro-preview';
        const parts: Part[] = [{ text: prompt }];
        if (Array.isArray(base64Media)) {
            base64Media.forEach(frame => parts.push({ inlineData: { data: frame, mimeType: 'image/jpeg' } }));
        } else {
            parts.push({ inlineData: { data: base64Media, mimeType } });
        }
        const response = await ai.models.generateContent({ model, contents: { parts } });
        return response.text || "No he encontrado detalles significativos 🧐🍷.";
    } catch (e) {
        const errorMsg = await handleApiError(e);
        throw new Error(errorMsg);
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });
        const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audio) throw new Error("Mi voz parece haberse desvanecido momentáneamente 🧐🍷.");
        return audio;
    } catch (e) {
        const errorMsg = await handleApiError(e);
        throw new Error(errorMsg);
    }
}

export const getLiveSession = () => getAi().live;

export const generateVideo = async (prompt: string, base64Image: string, mimeType: string, aspectRatio: VideoAspectRatio): Promise<string> => {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await requestKeySelection();
        }

        const ai = getAi();
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: { imageBytes: base64Image, mimeType: mimeType },
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
        });
        while (!operation.done) {
            await new Promise(r => setTimeout(r, 10000));
            operation = await ai.operations.getVideosOperation({ operation });
        }
        const link = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!link) throw new Error("La producción del video ha sido interrumpida 🧐🍷.");
        const res = await fetch(`${link}&key=${process.env.API_KEY}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        const errorMsg = await handleApiError(e);
        throw new Error(errorMsg);
    }
};
