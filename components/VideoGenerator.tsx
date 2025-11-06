import React, { useState, useRef, useEffect } from 'react';
import { generateVideo } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';
import { LoadingSpinner, VideoIcon } from './icons';
import { VideoAspectRatio } from '../types';

const loadingMessages = [
    "Iniciando la generación del video...",
    "El modelo está calentando motores...",
    "Procesando la imagen y la instrucción...",
    "La magia está en proceso, esto puede tardar unos minutos...",
    "Renderizando los fotogramas...",
    "Aplicando los toques finales...",
    "Casi listo, preparando tu video..."
];

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
    const [file, setFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [error, setError] = useState<string | null>(null);
    const [apiKeySelected, setApiKeySelected] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkApiKey = async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        }
    };

    useEffect(() => {
        checkApiKey();
    }, []);

    useEffect(() => {
        if (isLoading) {
            let messageIndex = 0;
            loadingIntervalRef.current = setInterval(() => {
                messageIndex = (messageIndex + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[messageIndex]);
            }, 5000); // Cambiar mensaje cada 5 segundos
        } else {
            if (loadingIntervalRef.current) {
                clearInterval(loadingIntervalRef.current);
                loadingIntervalRef.current = null;
            }
        }
        return () => {
            if (loadingIntervalRef.current) {
                clearInterval(loadingIntervalRef.current);
            }
        };
    }, [isLoading]);

    const handleSelectKey = async () => {
        await window.aistudio.openSelectKey();
        // Asumir que la selección de clave fue exitosa para evitar condiciones de carrera
        setApiKeySelected(true);
        setError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setGeneratedVideoUrl(null);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };
    
    const handleGenerate = async () => {
        if (!file || !prompt.trim() || isLoading || !apiKeySelected) return;
        
        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);

        try {
            const base64Image = await fileToBase64(file);
            const videoUrl = await generateVideo(prompt, base64Image, file.type, aspectRatio);
            setGeneratedVideoUrl(videoUrl);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            if (errorMessage.includes("Requested entity was not found")) {
                setError("La clave de API no es válida o no tiene los permisos necesarios. Por favor, selecciona una clave válida.");
                setApiKeySelected(false);
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const isGenerateDisabled = isLoading || !prompt.trim() || !file || !apiKeySelected;

    return (
        <div className="p-4 md:p-8 text-white h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-2 text-red-500">Generador de Video (Veo)</h2>
                <p className="text-center text-gray-400 mb-8">Crea videos cortos a partir de una imagen y una instrucción de texto.</p>

                {!apiKeySelected && (
                    <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">¡Acción requerida!</strong>
                        <span className="block sm:inline"> Se requiere una clave de API para usar el generador de video.</span>
                        <p className="text-sm mt-1">La generación de video con Veo puede incurrir en costos. Revisa la <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-yellow-200">documentación de facturación</a> para más detalles.</p>
                        <button onClick={handleSelectKey} className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded">
                            Seleccionar Clave de API
                        </button>
                    </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-8 items-center mb-8">
                    <div className="flex flex-col items-center justify-center bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-8 h-64 md:h-full">
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="max-w-full max-h-full object-contain rounded-md"/>
                        ) : (
                            <div className="text-center text-gray-400">
                                <VideoIcon className="w-16 h-16 mx-auto mb-4" />
                                <p>Sube una imagen para empezar</p>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="mt-4 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition" disabled={!apiKeySelected}>
                            {imagePreview ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                        </button>
                    </div>
                     <div className="space-y-4">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ej: Un holograma de neón de un gato conduciendo a toda velocidad"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none h-32"
                            disabled={isLoading || !apiKeySelected}
                        />
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Relación de Aspecto</label>
                            <div className="flex flex-wrap gap-2">
                                {(['16:9', '9:16'] as VideoAspectRatio[]).map(ratio => (
                                    <button
                                        key={ratio}
                                        onClick={() => setAspectRatio(ratio)}
                                        className={`px-4 py-2 text-sm rounded-md transition ${aspectRatio === ratio ? 'bg-red-600 font-semibold' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        disabled={!apiKeySelected}
                                    >
                                        {ratio} {ratio === '16:9' ? '(Paisaje)' : '(Retrato)'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    className="w-full bg-red-600 text-white font-bold py-3 rounded-lg flex items-center justify-center hover:bg-red-700 disabled:bg-gray-500 transition duration-200"
                >
                    {isLoading ? <><LoadingSpinner /> {loadingMessage}</> : 'Generar Video'}
                </button>

                {error && <div className="mt-6 p-3 text-center text-red-300 bg-red-900/50 rounded-lg">{error}</div>}

                {(isLoading || generatedVideoUrl) && (
                    <div className="mt-8">
                        <h3 className="text-xl font-semibold mb-4 text-center">Resultado</h3>
                        <div className="bg-gray-800 p-2 rounded-lg aspect-video flex items-center justify-center">
                            {isLoading ? (
                                <div className="text-center">
                                    <LoadingSpinner />
                                    <p className="mt-2 text-gray-300">{loadingMessage}</p>
                                </div>
                            ) : (
                                generatedVideoUrl && <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-auto object-contain rounded-md" />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoGenerator;
