
import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { LoadingSpinner, DownloadIcon, ImageIcon } from './icons';
import { AspectRatio, ImageSize } from '../types';

const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [size, setSize] = useState<ImageSize>('1K');
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const ratios: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];
    const sizes: ImageSize[] = ["1K", "2K", "4K"];

    const handleGenerate = async () => {
        if (!prompt.trim() || isLoading) return;
        setIsLoading(true); setError(null); setResult(null);
        try {
            const url = await generateImage(prompt, aspectRatio, size);
            setResult(url);
        } catch (e: any) { setError(e.message); } 
        finally { setIsLoading(false); }
    };

    return (
        <div className="h-full overflow-y-auto p-4 md:p-10 bg-gradient-to-b from-black to-zinc-950">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="text-center space-y-2 animate-fadeIn">
                    <div className="inline-flex p-3 bg-red-600/10 rounded-2xl mb-2"><ImageIcon className="w-8 h-8 text-red-500"/></div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Estudio Creativo</h2>
                    <p className="text-zinc-400">Genera imágenes de alta fidelidad con Gemini 3 Pro.</p>
                </div>

                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl animate-fadeIn" style={{animationDelay: '100ms'}}>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Un paisaje cyberpunk futurista con luces de neón..."
                            className="w-full bg-black/50 border border-zinc-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none h-32"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Formato</label>
                            <div className="grid grid-cols-3 gap-2">
                                {ratios.map(r => (
                                    <button key={r} onClick={() => setAspectRatio(r)} className={`py-2 px-3 text-xs rounded-lg font-medium transition-all border active:scale-95 ${aspectRatio === r ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>{r}</button>
                                ))}
                            </div>
                        </div>
                         <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Calidad</label>
                            <div className="grid grid-cols-3 gap-2">
                                {sizes.map(s => (
                                    <button key={s} onClick={() => setSize(s)} className={`py-2 px-3 text-xs rounded-lg font-medium transition-all border active:scale-95 ${size === s ? 'bg-zinc-100 border-white text-black' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>{s}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button onClick={handleGenerate} disabled={isLoading || !prompt} className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 rounded-xl font-bold text-white shadow-lg shadow-red-900/30 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                        {isLoading ? <LoadingSpinner /> : <>Generar Arte <span className="text-red-200 text-xs font-normal bg-red-800/30 px-2 py-0.5 rounded">Pro v3</span></>}
                    </button>
                </div>

                {error && <div className="p-4 bg-red-900/20 border border-red-900/50 text-red-300 rounded-xl text-center text-sm animate-fadeIn">{error}</div>}

                {result && (
                    <div className="animate-scaleIn space-y-4">
                        <div className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                            <img src={result} alt="Generado" className="w-full h-auto object-contain max-h-[600px]" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-6">
                                <a href={result} download={`arens-${Date.now()}.png`} className="bg-white text-black font-bold py-2 px-6 rounded-full flex items-center gap-2 hover:bg-zinc-200 transition-all active:scale-95">
                                    <DownloadIcon className="w-5 h-5" /> Descargar
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGenerator;