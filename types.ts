import { Content, Part } from '@google/genai';

export enum Tab {
  CHAT = 'Chat',
  IMAGE_GEN = 'Generar Imagen',
  IMAGE_EDIT = 'Editar Imagen',
  VIDEO_GEN = 'Generar Video',
  VISION = 'Análisis de Visión',
  LIVE = 'Conversación en Vivo',
}

export enum ChatMode {
  STANDARD = 'Estándar',
  LOW_LATENCY = 'Baja Latencia',
  COMPLEX = 'Complejo (Pensando)',
  WEB_SEARCH = 'Búsqueda Web',
  MAPS_SEARCH = 'Búsqueda en Mapas',
}

export interface Attachment {
  name: string;
  type: string;
  url: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: GroundingSource[];
  attachments?: Attachment[];
  // Los campos antiguos se mantienen para la retrocompatibilidad con el historial de localStorage
  mediaUrl?: string;
  mediaType?: string;
}


export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  history: Content[];
  mode: ChatMode;
  createdAt: number;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type VideoAspectRatio = "16:9" | "9:16";