import { GoogleGenAI, GenerateContentResponse, Modality, Part, GroundingChunk, Content } from "@google/genai";
import { ChatMode, AspectRatio, GroundingSource, VideoAspectRatio, ImageSize } from '../types';

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        if (!import.meta.env.VITE_API_KEY) {
            throw new Error("La variable de entorno VITE_API_KEY no está configurada");
        }
        // Usar import.meta.env.VITE_API_KEY tal como indicaste
        ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
    }
    return ai;
};

const extractSources = (groundingMetadata: GroundingChunk[] | undefined): GroundingSource[] => {
    if (!groundingMetadata) return [];
    const sources: GroundingSource[] = [];
    groundingMetadata.forEach(chunk => {
        if (chunk && (chunk as any).web) {
            const w = (chunk as any).web;
            if (w.title || w.uri) {
                sources.push({ title: w.title || '', uri: w.uri || '' });
            }
        }
        if (chunk && (chunk as any).maps) {
            const m = (chunk as any).maps;
            if (m.title || m.uri) {
                sources.push({ title: m.title || '', uri: m.uri || '' });
            }
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

    // Instrucción del sistema completa y coherente en español
    let systemInstruction = `Eres Arens IA, una inteligencia artificial sumamente sofisticada y elegante. Responde con estilo moderno y claro. Usa Markdown para estructurar cuando sea apropiado. IMPORTANTE: usa emojis con moderación y de forma contextual (no abuses). Mantén las respuestas concisas y útiles.`;

    // Add instruction for JSON suggestions
    systemInstruction += `

[PROTOCOLO DE SUGERENCIAS]: Al final de CADA respuesta, DEBES generar un bloque oculto con exactamente 3 sugerencias breves (máximo 5 palabras cada una) de preguntas o seguimientos que el usuario podría hacer. El bloque debe estar en formato JSON y encerrado en un bloque de código con la etiqueta \`json_suggestions\`. Ejemplo:
\`\`\`json_suggestions
["Pregunta 1","Pregunta 2","Pregunta 3"]
\`\`\`
Estas sugerencias deben ser relevantes al contexto de la respuesta y no deben mostrarse como parte del cuerpo principal (el cliente puede extraerlas del bloque).`;

    let config: any = {};
    let toolConfig: any = {};

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const containsUrl = urlRegex.test(prompt);

    // Override mode if URL is detected to ensure we can "read" it via search
    const effectiveMode = containsUrl ? ChatMode.WEB_SEARCH : mode;

    if (containsUrl) {
        systemInstruction += `

[INSTRUCCIÓN DE ANÁLISIS DE ENLACE]: El usuario ha proporcionado una URL. Cuando sea necesario, utiliza la herramienta de búsqueda web configurada para obtener información actualizada de la dirección. Extrae títulos, fechas y fragmentos relevantes. Si la URL apunta a contenido multimedia, intenta resumir el contenido y extraer enlaces y metadatos.`;
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
                // Normalizar la forma de pasar lat/lng según el código del servicio
                toolConfig.retrievalConfig = { latLng: { latitude: location.latitude, longitude: location.longitude } };
            }
            break;
        case ChatMode.CANVAS:
            modelName = 'gemini-3-pro-preview';
            systemInstruction = "Eres un experto en frontend. Genera código HTML/CSS/JS completo en un solo bloque y sin explicaciones adicionales. Devuelve sólo el bloque de código.";
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

    const userMessageContent: { parts: Part[] } = { parts: [{ text: prompt } as Part] };
    if (mediaParts) {
        userMessageContent.parts.push(...mediaParts);
    }

    // Crear chat (defensivo: permitir que create sea sincrónico o asíncrono)
    // y tipar la respuesta como any para evitar errores estrictos si la SDK cambia
    const chat: any = ai.chats.create ? ai.chats.create({ model: modelName, history, config, toolConfig }) : ai.chats;
    const response: any = await chat.sendMessage ? await chat.sendMessage({ message: userMessageContent }) : await (chat as any)({ message: userMessageContent });

    const parts: any[] = response?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => typeof (p as any).text === 'string');
    let text = textPart ? (textPart as any).text as string : (response?.text || '');

    // Parse suggestions from text (bloque oculto)
    let suggestions: string[] = [];
    const suggestionRegex = /```json_suggestions\s*(\[[\s\S]*?\])\s*```/;
    const match = text.match(suggestionRegex);

    if (match && match[1]) {
        try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed)) {
                suggestions = parsed.map(String).slice(0, 3);
            }
            // Remove the JSON block from the visible text
            text = text.replace(match[0], '').trim();
        } catch (e) {
            console.error("Failed to parse suggestions JSON", e);
        }
    }

    const mediaPart = parts.find(p => (p as any).inlineData);
    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    if (mediaPart && (mediaPart as any).inlineData) {
        mediaUrl = `data:${(mediaPart as any).inlineData.mimeType};base64,${(mediaPart as any).inlineData.data}`;
        mediaType = (mediaPart as any).inlineData.mimeType;
    }

    const groundingChunks: any[] = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = extractSources(groundingChunks);

    return { text, sources, mediaUrl, mediaType, historyParts: parts, suggestions };
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio, size: ImageSize): Promise<string> => {
    const ai = getAi();
    // Using gemini-3-pro-image-preview for high quality generation
    const response: any = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio,
                imageSize: size
            }
        }
    });

    for (const part of response?.candidates?.[0]?.content?.parts || []) {
        if ((part as any).inlineData) {
            return `data:${(part as any).inlineData.mimeType};base64,${(part as any).inlineData.data}`;
        }
    }
    throw new Error("No se pudo generar la imagen.");
};

export const editImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAi();
    const imagePart: Part = { inlineData: { data: base64Image, mimeType } } as any;
    const textPart: Part = { text: prompt } as any;

    // Using gemini-2.5-flash-image for editing
    const response: any = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [textPart, imagePart] },
    });

    for (const part of response?.candidates?.[0]?.content?.parts || []) {
        if ((part as any).inlineData) {
            return `data:${(part as any).inlineData.mimeType};base64,${(part as any).inlineData.data}`;
        }
    }
    throw new Error("No se pudo editar la imagen.");
};

export const analyzeMedia = async (base64Media: string | string[], mimeType: string, prompt: string): Promise<string> => {
    const ai = getAi();
    // Using gemini-3-pro-preview for deep understanding
    const model = 'gemini-3-pro-preview';
    const parts: Part[] = [{ text: prompt } as Part];

    if (Array.isArray(base64Media)) {
        base64Media.forEach(frame => {
            parts.push({ inlineData: { data: frame, mimeType: 'image/jpeg' } } as Part);
        });
    } else {
        parts.push({ inlineData: { data: base64Media, mimeType } } as Part);
    }

    const response: any = await ai.models.generateContent({
        model,
        contents: { parts },
    });

    const textPart = (response?.candidates?.[0]?.content?.parts || []).find((p: any) => typeof p.text === 'string');
    if (textPart) return textPart.text;
    // Fallback: concatenate all textual parts
    const allText = (response?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').filter(Boolean).join('\n');
    return allText || "No se pudo generar una respuesta.";
};

export const generateSpeech = async (text: string): Promise<string> => {
    const ai = getAi();
    const response: any = await ai.models.generateContent({
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

    const base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Error al generar el audio.");
    }
    return base64Audio;
};

export const getLiveSession = () => {
    return getAi().live;
};

export const generateVideo = async (
    prompt: string,
    base64Image: string,
    mimeType: string,
    aspectRatio: VideoAspectRatio
): Promise<string> => {
    if (!import.meta.env.VITE_API_KEY) {
        throw new Error("La variable de entorno VITE_API_KEY no está configurada");
    }
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

    // Using Veo 3.1 Fast (defensivo con any)
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

    // Poll until done (forma defensiva, la estructura de operation puede variar según SDK)
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        try {
            // Intentar obtener el estado usando la API de operaciones (forma común)
            if (ai.operations && typeof ai.operations.getVideosOperation === 'function') {
                try {
                    operation = await ai.operations.getVideosOperation({ name: operation.name || operation.operationName || operation.id });
                } catch (e) {
                    operation = await ai.operations.getVideosOperation(operation.name || operation.operationName || operation.id);
                }
            } else if (ai.operations && typeof ai.operations.get === 'function') {
                operation = await ai.operations.get(operation.name || operation.operationName || operation.id);
            } else {
                // Si no hay forma de refrescar, rompemos para evitar loop infinito
                break;
            }
        } catch (err) {
            console.warn("Error al refrescar operación de video:", err);
            // seguir intentando hasta que timeout externo se ocupe
        }
    }

    const downloadLink = operation?.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("No se pudo obtener el enlace de descarga del video.");
    }

    // Descargar con la API key anexada (si el enlace lo requiere)
    const keyParam = import.meta.env.VITE_API_KEY ? `&key=${import.meta.env.VITE_API_KEY}` : '';
    const response = await fetch(`${downloadLink}${keyParam}`);
    if (!response.ok) {
        throw new Error(`Error al descargar el video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    // En entorno de navegador, crear URL; en Node esto no existirá y el llamador deberá manejarlo
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        // Browser environment
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return URL.createObjectURL(videoBlob);
    } else {
        // Node: devolver ArrayBuffer base64 para que el llamador decida
        const arrayBuffer = await videoBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return `data:${videoBlob.type || 'video/mp4'};base64,${buffer.toString('base64')}`;
    }
};
