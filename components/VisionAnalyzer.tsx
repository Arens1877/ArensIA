
import React, { useState, useRef } from 'react';
import { analyzeMedia } from '../services/geminiService';
import { fileToBase64, extractFramesFromVideo } from '../utils/helpers';
import { LoadingSpinner, XIcon } from './icons';

const VisionAnalyzer: React.FC = () => {
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('Analizando...');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setAnalysisResult(null);
            setError(null);
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };
    
    const handleAnalyze = async () => {
        if (!file || !prompt.trim() || isLoading) return;
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        
        try {
            let result = '';
            if (file.type.startsWith('image/')) {
                setLoadingText('Analizando imagen...');
                const base64Image = await fileToBase64(file);
                result = await analyzeMedia(base64Image, file.type, prompt);
            } else if (file.type.startsWith('video/')) {
                setLoadingText('Extrayendo fotogramas del video...');
                const frames = await extractFramesFromVideo(file, 1);
                if (frames.length === 0) {
                    throw new Error("No he podido extraer los fotogramas necesarios de su video. Quizás el formato no sea el más refinado 🧐🍷.");
                }
                setLoadingText(`Analizando ${frames.length} fotogramas...`);
                result = await analyzeMedia(frames, file.type, prompt);
            } else {
                throw new Error("Mis disculpas, pero ese tipo de archivo no está en mi catálogo de soporte actual. Por favor, suba una imagen o video 🧐🍷.");
            }
            setAnalysisResult(result);
        } catch (err: any) {
            setError(err instanceof Error ? err.message : 'Un contratiempo inesperado en la visión ha ocurrido 🧐🍷.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 text-white h-full overflow-y-auto no-scrollbar bg-gradient-to-b from-black to-zinc-950">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-2 animate-fadeIn">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Análisis de Visión 🧐🍷</h2>
                    <p className="text-zinc-400">Comprenda el contenido de sus medios con absoluta distinción.</p>
                </div>

                <div className="flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-xl border-2 border-dashed border-zinc-700 rounded-3xl p-6 md:p-8 min-h-[250px] md:min-h-[350px] shadow-2xl relative transition-all group overflow-hidden">
                    {mediaPreview ? (
                        file?.type.startsWith('image/') ? (
                            <img src={mediaPreview} alt="Preview" className="max-w-full max-h-80 object-contain rounded-2xl shadow-2xl animate-scaleIn"/>
                        ) : (
                            <video src={mediaPreview} controls className="max-w-full max-h-80 object-contain rounded-2xl shadow-2xl animate-scaleIn"/>
                        )
                    ) : (
                        <div className="text-center text-zinc-600 space-y-4">
                            <div className="w-16 h-16 mx-auto border-2 border-zinc-800 rounded-full flex items-center justify-center opacity-30">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                            <p className="font-medium tracking-tight">Deposite aquí su imagen o video para mi inspección</p>
                        </div>
                    )}
                    <input type="file" accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden"/>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-6 bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-full font-bold transition-all border border-white/5 active:scale-95">
                        {mediaPreview ? 'Cambiar Medio' : 'Seleccionar Archivo'}
                    </button>
                </div>

                <div className="space-y-4 animate-fadeIn" style={{animationDelay: '100ms'}}>
                     <div className="relative group">
                        <textarea
                            value={prompt}
                            onChange={(e) => { setPrompt(e.target.value); if(error) setError(null); }}
                            placeholder="Ej: ¿Qué está pasando en esta escena? Describe los objetos presentes con elegancia."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all outline-none resize-none h-32 text-white shadow-inner"
                            disabled={isLoading || !mediaPreview}
                        />
                     </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !mediaPreview || !prompt.trim()}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center shadow-xl shadow-red-900/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <><LoadingSpinner /> {loadingText}</> : 'Analizar con Arens IA'}
                    </button>
                </div>
                
                {error && (
                    <div className="p-5 text-center text-red-300 bg-red-950/20 border border-red-900/30 rounded-2xl animate-fadeIn shadow-lg flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <span className="text-2xl">🧐🍷</span>
                            <span className="text-sm font-medium">{error}</span>
                         </div>
                         <button onClick={() => setError(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><XIcon className="w-5 h-5"/></button>
                    </div>
                )}

                {analysisResult && (
                    <div className="animate-scaleIn pt-4">
                        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] shadow-2xl relative">
                            <div className="absolute top-0 right-10 -translate-y-1/2 bg-red-600 text-white px-6 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-lg">Conclusiones IA</div>
                            <p className="whitespace-pre-wrap text-zinc-200 leading-relaxed font-medium italic">"{analysisResult}"</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisionAnalyzer;
