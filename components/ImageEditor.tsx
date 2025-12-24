
import React, { useState, useRef } from 'react';
import { editImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';
import { LoadingSpinner, DownloadIcon, ImageIcon } from './icons';

const ImageEditor: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setEditedImage(null);
            const reader = new FileReader();
            reader.onloadend = () => {
                setOriginalImage(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };
    
    const handleEdit = async () => {
        if (!file || !prompt.trim() || isLoading) return;
        setIsLoading(true);
        setError(null);

        try {
            const base64Image = await fileToBase64(file);
            const imageUrl = await editImage(base64Image, file.type, prompt);
            setEditedImage(imageUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado 🍷🧐');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-10 text-white h-full overflow-y-auto bg-gradient-to-b from-black to-zinc-950 no-scrollbar">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="text-center space-y-2 animate-fadeIn">
                    <div className="inline-flex p-3 bg-red-600/10 rounded-2xl mb-2"><ImageIcon className="w-8 h-8 text-red-500"/></div>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Image Refiner</h2>
                    <p className="text-zinc-400">Edición inteligente guiada por Gemini Vision.</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-6 items-stretch animate-fadeIn" style={{animationDelay: '100ms'}}>
                    {/* Original */}
                    <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] transition-all group overflow-hidden relative">
                        {originalImage ? (
                            <img src={originalImage} alt="Original" className="max-w-full max-h-[350px] object-contain rounded-2xl shadow-2xl animate-scaleIn"/>
                        ) : (
                            <div className="text-center text-zinc-500 space-y-3">
                                <ImageIcon className="w-12 h-12 mx-auto opacity-20" />
                                <p className="font-medium">Sube una imagen para refinar</p>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="mt-6 bg-white/5 hover:bg-white/10 text-white px-6 py-2.5 rounded-full font-bold transition-all active:scale-95 border border-white/10">
                            {originalImage ? 'Cambiar Imagen' : 'Seleccionar Archivo'}
                        </button>
                    </div>

                    {/* Result */}
                    <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] relative overflow-hidden shadow-inner">
                        {isLoading && (
                            <div className="flex flex-col items-center animate-fadeIn">
                                <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-red-500 font-bold tracking-widest uppercase text-xs">Procesando con IA...</p>
                            </div>
                        )}
                        {!isLoading && editedImage && (
                            <div className="text-center w-full">
                                <img src={editedImage} alt="Edited" className="max-w-full max-h-[350px] mx-auto object-contain rounded-2xl shadow-2xl shadow-red-900/10 animate-scaleIn"/>
                                <a
                                    href={editedImage}
                                    download={`arens-edited-${Date.now()}.jpg`}
                                    className="inline-flex items-center justify-center bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-red-900/30 transition-all active:scale-95 mt-6"
                                >
                                    <DownloadIcon className="h-5 w-5 mr-2" />
                                    Descargar Obra
                                </a>
                            </div>
                        )}
                        {!isLoading && !editedImage && (
                            <div className="text-center text-zinc-600 space-y-3">
                                <ImageIcon className="w-12 h-12 mx-auto opacity-10" />
                                <p className="font-medium text-sm">El resultado aparecerá aquí</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-zinc-900/80 border border-white/10 rounded-[2rem] p-6 md:p-8 space-y-6 shadow-2xl animate-fadeIn" style={{animationDelay: '200ms'}}>
                     <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                             Comandos de Edición <span className="bg-red-600/10 text-red-500 px-2 py-0.5 rounded text-[10px]">Elegante</span>
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ej: 'Añade un filtro cinematográfico cálido', 'Convierte el cielo en un atardecer púrpura', 'Estilo óleo'..."
                            className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-5 text-white focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all outline-none resize-none h-28"
                            disabled={isLoading || !originalImage}
                        />
                     </div>
                    <button
                        onClick={handleEdit}
                        disabled={isLoading || !originalImage || !prompt.trim()}
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center shadow-xl shadow-red-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                        {isLoading ? <LoadingSpinner /> : 'Refinar Imagen con Arens IA'}
                    </button>
                </div>

                {error && <div className="p-4 text-center text-red-400 bg-red-950/20 border border-red-900/30 rounded-2xl animate-fadeIn">{error}</div>}
            </div>
        </div>
    );
};

export default ImageEditor;
