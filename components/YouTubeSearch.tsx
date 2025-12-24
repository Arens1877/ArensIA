
import React, { useState } from 'react';
import { searchYouTube } from '../services/youtubeService';
import { YouTubeVideo } from '../types';
import { YouTubeIcon, SearchIcon, LoadingSpinner, XIcon } from './icons';
import { useTheme } from '../contexts/ThemeContext';

const YouTubeSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const { currentTheme } = useTheme();

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setVideos([]);

    try {
      const results = await searchYouTube(query);
      if (results.length === 0) {
          setError("Mi búsqueda no ha arrojado resultados para tal petición. Quizás una terminología más refinada sea apropiada 🧐🍷.");
      } else {
          setVideos(results);
      }
    } catch (err: any) {
      let msg = err.message || "Un contratiempo inesperado ha ocurrido.";
      if (msg.includes("API_KEY")) {
          msg = "La llave de acceso a YouTube no ha sido configurada. Por favor, asegúrese de que el sistema cuente con sus credenciales correspondientes 🧐🍷.";
      } else if (msg.includes("quota")) {
          msg = "Parece que YouTube ha limitado nuestras consultas por hoy. Un momento de paciencia sería lo ideal 🧐🍷.";
      } else {
          msg = `${msg} 🧐🍷`;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-black to-zinc-950">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Search Bar */}
        <div className="space-y-6 text-center animate-fadeIn">
            <div className="inline-flex items-center gap-3 mb-2">
                <YouTubeIcon className="w-10 h-10 text-red-600" />
                <h2 className="text-3xl font-bold text-white tracking-tight">YouTube Explorer</h2>
            </div>
            
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative group">
                <div className={`absolute -inset-0.5 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-500 ${currentTheme.colors.primary.replace('bg-', 'bg-')}`}></div>
                <div className="relative flex items-center bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden p-1 focus-within:ring-2 focus-within:ring-white/20 transition-all">
                    <div className="pl-4 text-zinc-400">
                        <SearchIcon className="w-6 h-6" />
                    </div>
                    <input 
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); if(error) setError(null); }}
                        placeholder="Busca videos, tutoriales, música..."
                        className="w-full bg-transparent border-none text-white text-lg px-4 py-3 focus:outline-none placeholder-zinc-600"
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !query}
                        className={`px-6 py-3 rounded-xl font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${currentTheme.colors.primary} ${currentTheme.colors.hover}`}
                    >
                        {isLoading ? <LoadingSpinner /> : 'Buscar'}
                    </button>
                </div>
            </form>
        </div>

        {/* Error Message */}
        {error && (
            <div className="max-w-2xl mx-auto bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl flex items-center justify-between animate-fadeIn shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="bg-red-500/20 p-2 rounded-full"><XIcon className="w-5 h-5 text-red-500" /></div>
                    <div>
                        <p className="font-bold">Contratiempo en la búsqueda 🧐🍷</p>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
                <button onClick={() => setError(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>
        )}

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video, idx) => (
                <div 
                    key={video.id} 
                    onClick={() => setSelectedVideo(video)}
                    className="group bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:bg-zinc-800 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 animate-scaleIn shadow-lg"
                    style={{animationDelay: `${idx * 50}ms`}}
                >
                    <div className="aspect-video w-full relative overflow-hidden">
                        <img 
                            src={video.thumbnail} 
                            alt={video.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/60 backdrop-blur-[2px]`}>
                             <div className={`w-12 h-12 rounded-full ${currentTheme.colors.primary} flex items-center justify-center text-white shadow-xl scale-0 group-hover:scale-100 transition-transform duration-300`}>
                                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                             </div>
                        </div>
                    </div>
                    
                    <div className="p-4">
                        <h3 className="text-white font-semibold line-clamp-2 mb-2 group-hover:text-white/90 leading-snug" dangerouslySetInnerHTML={{ __html: video.title }}></h3>
                        <div className="flex items-center justify-between text-xs text-zinc-500 mt-2">
                            <span className="flex items-center gap-1 hover:text-zinc-300 transition-colors">
                                <div className="w-4 h-4 rounded-full bg-zinc-700"></div>
                                {video.channelTitle}
                            </span>
                            <span>{new Date(video.publishTime).getFullYear()}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        
        {!isLoading && videos.length === 0 && !error && (
            <div className="text-center py-20 opacity-30 animate-fadeIn">
                <YouTubeIcon className="w-24 h-24 mx-auto mb-4" />
                <p className="text-xl italic font-light">Explore el mundo del video con distinción...</p>
            </div>
        )}
      </div>

      {/* Video Modal (Lightbox) */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fadeIn">
            <div className="w-full max-w-5xl bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative flex flex-col animate-scaleIn">
                <div className="p-4 flex justify-between items-center border-b border-zinc-800">
                    <h3 className="font-bold text-white line-clamp-1 pr-4" dangerouslySetInnerHTML={{ __html: selectedVideo.title }}></h3>
                    <button onClick={() => setSelectedVideo(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="aspect-video w-full bg-black">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1`} 
                        title={selectedVideo.title} 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                </div>
                <div className="p-6 max-h-40 overflow-y-auto bg-zinc-900/50">
                     <div className="flex items-center justify-between mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${currentTheme.colors.secondary} ${currentTheme.colors.text}`}>
                            {selectedVideo.channelTitle}
                        </span>
                        <span className="text-zinc-500 text-sm">
                            {new Date(selectedVideo.publishTime).toLocaleDateString()}
                        </span>
                     </div>
                     <p className="text-zinc-400 text-sm whitespace-pre-wrap leading-relaxed">{selectedVideo.description}</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeSearch;
