
import { Content, Part } from '@google/genai';

export enum Tab {
  CHAT = 'Chat',
  IMAGE_GEN = 'Crear Imagen',
  IMAGE_EDIT = 'Editar Imagen',
  VIDEO_GEN = 'Crear Video',
  VISION = 'Visión',
  LIVE = 'Live',
  YOUTUBE = 'YouTube',
}

export enum ChatMode {
  STANDARD = 'Estándar',
  LOW_LATENCY = 'Flash Lite',
  LIVE_SEARCH = 'Búsqueda Rápida',
  COMPLEX = 'Pro (Pensando)',
  WEB_SEARCH = 'Búsqueda Profunda',
  MAPS_SEARCH = 'Mapas',
  CANVAS = 'Canvas',
}

export interface Attachment {
  name: string;
  type: string;
  url: string;
  status?: 'uploading' | 'completed' | 'error';
  progress?: number;
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: GroundingSource[];
  attachments?: Attachment[];
  mediaUrl?: string;
  mediaType?: string;
  suggestions?: string[];
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
  isFavorite?: boolean;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishTime: string;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9";
export type VideoAspectRatio = "16:9" | "9:16";
export type ImageSize = "1K" | "2K" | "4K";
