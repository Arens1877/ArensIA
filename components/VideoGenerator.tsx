
import React, { useState, useRef } from 'react';
import { generateVideo } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';
import { LoadingSpinner, VideoIcon, PlusIcon } from './icons';
import { VideoAspectRatio } from '../types';

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f && f.type.startsWith('image/')) {
            setFile(f);
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(f);
        }
    };

    const handleGenerate = async () => {
        if (!file || !prompt || isLoading) return;
        setIsLoading(true); setError(null); setVideoUrl(null);
        try {
            const hasKey = window.aistudio ? await window.aistudio.hasSelectedApiKey() : false;
            if (!hasKey && window.aistudio) await window.aistudio.openSelectKey();
            
            const base64 = await fileToBase64(file);
            const url = await generateVideo(prompt, base64, file.type, aspectRatio);
            setVideoUrl(url);
        } catch (e: any) { setError(e.message); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="h-full overflow-y-auto p-4 md:p-10 bg-gradient-to-b from-black to-zinc-950">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-2 animate-fadeIn">
                    <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl mb-2"><VideoIcon className="w-8 h-8 text-blue-500"/></div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Veo Video Studio</h2>
                    <p className="text-zinc-400">Da vida a tus imágenes con movimiento cinematográfico.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 animate-fadeIn" style={{animationDelay: '100ms'}}>
                    <div className="space-y-6">
                        <div onClick={() => fileInputRef.current?.click()} className={`aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center relative overflow-hidden group active:scale-[0.98] ${preview ? 'border-transparent' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50'}`}>
                            {preview ? <img src={preview} className="w-full h-full object-cover animate-scaleIn" /> : <div className="text-center p-6"><PlusIcon className="w-10 h-10 mx-auto text-zinc-600 mb-2"/><span className="text-zinc-500 text-sm">Subir imagen base</span></div>}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-medium">Cambiar Imagen</div>
                            <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*"/>
                        </div>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe el movimiento (ej: cámara lenta, zoom, el coche acelera...)" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32" />
                        <div className="flex gap-2">
                            {(['16:9', '9:16'] as VideoAspectRatio[]).map(r => (
                                <button key={r} onClick={() => setAspectRatio(r)} className={`flex-1 py-3 rounded-xl font-medium text-sm border transition-all active:scale-95 ${aspectRatio === r ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}>{r}</button>
                            ))}
                        </div>
                        <button onClick={handleGenerate} disabled={isLoading || !file || !prompt} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-blue-900/30 transition-all disabled:opacity-50 active:scale-[0.98]">
                            {isLoading ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Generando (esto toma tiempo)...</span> : 'Generar Video'}
                        </button>
                        {error && <div className="text-red-400 text-sm text-center bg-red-900/10 p-3 rounded-lg animate-fadeIn">{error}</div>}
                    </div>

                    <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-1 flex items-center justify-center aspect-video relative">
                        {videoUrl ? (
                            <video src={videoUrl} controls autoPlay loop className="w-full h-full rounded-xl animate-scaleIn" />
                        ) : (
                            <div className="text-center text-zinc-600">
                                <VideoIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p>El video generado aparecerá aquí</p>
                            </div>
                        )}
                        {isLoading && !videoUrl && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm rounded-xl animate-fadeIn"><LoadingSpinner/><p className="mt-4 text-zinc-300 animate-pulse">Renderizando con Veo...</p></div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoGenerator;