
import React, { useState, useRef } from 'react';
import { analyzeMedia } from '../services/geminiService';
import { fileToBase64, extractFramesFromVideo } from '../utils/helpers';
import { LoadingSpinner } from './icons';

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
                const frames = await extractFramesFromVideo(file, 1); // 1 frame per second
                if (frames.length === 0) {
                    throw new Error("No se pudieron extraer fotogramas del video.");
                }
                setLoadingText(`Analizando ${frames.length} fotogramas...`);
                result = await analyzeMedia(frames, file.type, prompt);
            } else {
                throw new Error("Tipo de archivo no soportado. Por favor, sube una imagen o un video.");
            }
            setAnalysisResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 text-white h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-2 text-red-500">Análisis de Visión</h2>
                <p className="text-center text-gray-400 mb-8">Comprende el contenido de tus imágenes y videos.</p>

                <div className="flex flex-col items-center justify-center bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 md:p-8 min-h-[200px] md:min-h-[300px]">
                    {mediaPreview ? (
                        file?.type.startsWith('image/') ? (
                            <img src={mediaPreview} alt="Preview" className="max-w-full max-h-80 object-contain rounded-md"/>
                        ) : (
                            <video src={mediaPreview} controls className="max-w-full max-h-80 object-contain rounded-md"/>
                        )
                    ) : (
                        <div className="text-center text-gray-400">
                            <p>Sube una imagen o video para analizar</p>
                        </div>
                    )}
                    <input type="file" accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden"/>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-4 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition">
                        {mediaPreview ? 'Cambiar Archivo' : 'Seleccionar Archivo'}
                    </button>
                </div>

                <div className="mt-8 space-y-4">
                     <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ej: ¿Qué está pasando en esta escena? Describe los objetos presentes."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none h-24"
                        disabled={isLoading || !mediaPreview}
                    />
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !mediaPreview || !prompt.trim()}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-lg flex items-center justify-center hover:bg-red-700 disabled:bg-gray-500 transition duration-200"
                    >
                        {isLoading ? <><LoadingSpinner /> {loadingText}</> : 'Analizar Archivo'}
                    </button>
                </div>
                
                {error && <div className="mt-6 p-3 text-center text-red-300 bg-red-900/50 rounded-lg">{error}</div>}

                {analysisResult && (
                    <div className="mt-8">
                        <h3 className="text-xl font-semibold mb-4 text-center">Resultado del Análisis</h3>
                        <div className="bg-gray-800 p-4 rounded-lg">
                            <p className="whitespace-pre-wrap text-gray-300">{analysisResult}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisionAnalyzer;
