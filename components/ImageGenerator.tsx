import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { LoadingSpinner } from './icons';
import { AspectRatio } from '../types';

const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const aspectRatios: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

    const handleGenerate = async () => {
        if (!prompt.trim() || isLoading) return;
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const imageUrl = await generateImage(prompt, aspectRatio);
            setGeneratedImage(imageUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 text-white h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-2 text-red-500">Generación de Imágenes</h2>
                <p className="text-center text-gray-400 mb-8">Crea imágenes impresionantes con una simple instrucción de texto.</p>

                <div className="space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ej: Un león majestuoso con una corona, iluminación cinematográfica, hiperrealista"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none h-24"
                        disabled={isLoading}
                    />
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Relación de Aspecto</label>
                        <div className="flex flex-wrap gap-2">
                            {aspectRatios.map(ratio => (
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
                        disabled={isLoading || !prompt.trim()}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-lg flex items-center justify-center hover:bg-red-700 disabled:bg-gray-500 transition duration-200"
                    >
                        {isLoading ? <><LoadingSpinner /> Generando...</> : 'Generar Imagen'}
                    </button>
                </div>

                {error && <div className="mt-6 p-3 text-center text-red-300 bg-red-900/50 rounded-lg">{error}</div>}

                {generatedImage && (
                    <div className="mt-8">
                        <h3 className="text-xl font-semibold mb-4 text-center">Resultado</h3>
                        <div className="bg-gray-800 p-2 rounded-lg">
                            <img src={generatedImage} alt="Generated" className="w-full max-w-lg mx-auto h-auto object-contain rounded-md" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGenerator;