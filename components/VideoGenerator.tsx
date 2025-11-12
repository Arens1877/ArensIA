
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
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Asumimos que el usuario seleccionó una clave y volvemos a verificar.
            // Debido a condiciones de carrera, podemos ser optimistas aquí.
            setApiKeySelected(true); 
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith('image/')) {
                setError('Por favor, sube solo archivos de imagen.');
                return;
            }
            setError(null);
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
        if (!file || !prompt.trim() || isLoading) return;
        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);

        try {
            const hasKey = window.aistudio ? await window.aistudio.hasSelectedApiKey() : false;
            if (!hasKey) {
                 setApiKeySelected(false);
                 throw new Error("Por favor, selecciona una clave de API primero.");
            }

            const base64Image = await fileToBase64(file);
            const videoUrl = await generateVideo(prompt, base64Image, file.type, aspectRatio);
            setGeneratedVideoUrl(videoUrl);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
             if (errorMessage.includes("Requested entity was not found.") || errorMessage.includes("API key")) {
                setError("La clave de API no es válida o no tiene los permisos necesarios. Por favor, selecciona otra clave.");
                setApiKeySelected(false);
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!apiKeySelected) {
        return (
            <div className="p-4 md:p-8 text-white h-full flex flex-col items-center justify-center text-center">
                 <VideoIcon className="h-16 w-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Generador de Video (Veo)</h2>
                <p className="max-w-md text-gray-400 mb-6">Para usar esta función, necesitas seleccionar una clave de API de Google AI Studio que tenga acceso al modelo Veo y la facturación habilitada.</p>
                <button
                    onClick={handleSelectKey}
                    className="bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition duration-200"
                >
                    Seleccionar Clave de API
                </button>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="mt-4 text-sm text-red-400 hover:underline">
                    Más información sobre la facturación
                </a>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8 text-white h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-2 text-red-500">Generación de Video</h2>
                <p className="text-center text-gray-400 mb-8">Crea un video a partir de una imagen inicial y una instrucción.</p>

                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-6 min-h-[200px]">
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="max-w-full max-h-60 object-contain rounded-md"/>
                        ) : (
                            <div className="text-center text-gray-400">
                                <p>Sube una imagen de inicio</p>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="mt-4 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition">
                            {imagePreview ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                        </button>
                    </div>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ej: Un coche de carreras futurista conduciendo a través de una ciudad de neón por la noche."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none h-24"
                        disabled={isLoading}
                    />
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Relación de Aspecto</label>
                        <div className="flex flex-wrap gap-2">
                            {(['16:9', '9:16'] as VideoAspectRatio[]).map(ratio => (
                                <button
                                    key={ratio}
                                    onClick={() => setAspectRatio(ratio)}
                                    className={`px-4 py-2 text-sm rounded-md transition ${aspectRatio === ratio ? 'bg-red-600 font-semibold' : 'bg-gray-700 hover:bg-gray-600'}`}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !file || !prompt.trim()}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-lg flex items-center justify-center hover:bg-red-700 disabled:bg-gray-500 transition duration-200"
                    >
                        {isLoading ? <><LoadingSpinner /> {loadingMessage}</> : 'Generar Video'}
                    </button>
                </div>

                {error && <div className="mt-6 p-3 text-center text-red-300 bg-red-900/50 rounded-lg">{error}</div>}

                {(isLoading || generatedVideoUrl) && (
                     <div className="mt-8">
                        <h3 className="text-xl font-semibold mb-4 text-center">Resultado</h3>
                        <div className="bg-gray-800 p-2 rounded-lg flex justify-center items-center aspect-video">
                            {isLoading && !generatedVideoUrl && <div className="text-center"><LoadingSpinner/><p className="mt-2">{loadingMessage}</p></div>}
                            {generatedVideoUrl && <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-auto object-contain rounded-md" />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoGenerator;
