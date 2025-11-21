
import { YouTubeVideo } from '../types';

const API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const searchYouTube = async (query: string): Promise<YouTubeVideo[]> => {
  if (!API_KEY) {
    throw new Error("La variable de entorno YOUTUBE_API_KEY no está configurada.");
  }

  const params = new URLSearchParams({
    part: 'snippet',
    maxResults: '20',
    q: query,
    key: API_KEY,
    type: 'video'
  });

  const response = await fetch(`${BASE_URL}/search?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Error al buscar videos en YouTube');
  }

  const data = await response.json();

  return data.items.map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
    channelTitle: item.snippet.channelTitle,
    publishTime: item.snippet.publishTime,
  }));
};
