import { GoogleGenAI, GenerateContentResponse, Modality, Part, GroundingChunk, Content } from "@google/genai";
import { ChatMode, AspectRatio, GroundingSource, VideoAspectRatio, ImageSize } from '../types';

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        const apiKey =
            // Prefer Node-style env var, fallback to Vite import.meta.env if available (for frontend builds)
            (process && (process.env as any) && (process.env as any).API_KEY) ||
            (typeof import !== 'undefined' && typeof (import as any).meta !== 'undefined' ? (import as any).meta.env?.VITE_API_KEY : undefined);

        if (!apiKey) {
            throw new Error("La variable de entorno API_KEY no está configurada");
        }

        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

const extractSources = (groundingChunks: GroundingChunk[] | undefined): GroundingSource[] => {
    if (!groundingChunks) return [];
    const sources: GroundingSource[] = [];
    groundingChunks.forEach(chunk => {
        if (chunk.web) {
            sources.push({ title: chunk.web.title || '', uri: chunk.web.uri || '' });
        }
        if (chunk.maps) {
            sources.push({ title: chunk.maps.title || '', uri: chunk.maps.uri || '' });
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
    
    // Default system instruction (Spanish)
    let systemInstruction = `Eres Arens IA, una inteligencia artificial sumamente sofisticada y elegante. Responde con estilo moderno y claro, usa Markdown para estructurar las respuestas y emojis con naturalidad cuando sea apropiado. Mantén las respuestas útiles y concisas.`;

    // Add instruction for JSON suggestions - model should include a hidden JSON block with exactly 3 suggestions
    systemInstruction += `

[PROTOCOLO DE SUGERENCIAS]: Al final de CADA respuesta, DEBES generar un bloque oculto (delimitado por \`\`\`json_suggestions ... \`\`\`) que contenga exactamente 3 sugerencias breves en formato JSON (una lista de strings). Cada sugerencia debe tener como máximo 5 palabras. Ejemplo del bloque esperado:
\`\`\`json_suggestions
