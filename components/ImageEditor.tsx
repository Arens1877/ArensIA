
import React, { useState, useRef } from 'react';
import { editImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';
import { LoadingSpinner, DownloadIcon } from './icons';

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
            setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 text-white h-full overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-2 text-red-500">Editor de Imágenes</h2>
                <p className="text-center text-gray-400 mb-8">Modifica tus imágenes con comandos descriptivos.</p>

                <div className="grid md:grid-cols-2 gap-4 md:gap-8 items-start">
                    <div className="flex flex-col items-center justify-center bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 md:p-8 h-full">
                        {originalImage ? (
                            <img src={originalImage} alt="Original" className="max-w-full max-h-96 object-contain rounded-md"/>
                        ) : (
                            <div className="text-center text-gray-400">
                                <p>Sube una imagen para empezar</p>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="mt-4 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition">
                            {originalImage ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                        </button>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 md:p-8 h-full">
                        {isLoading && <div className="flex flex-col items-center"><LoadingSpinner/><p className="mt-2">Editando...</p></div>}
                        {!isLoading && editedImage && (
                            <div className="text-center">
                                <img src={editedImage} alt="Edited" className="max-w-full max-h-96 object-contain rounded-md"/>
                                <a
                                    href={editedImage}
                                    download="Arens_IA_editada.jpg"
                                    className="inline-flex items-center justify-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition duration-200 mt-4"
                                >
                                    <DownloadIcon className="h-5 w-5 mr-2" />
                                    Descargar Imagen
                                </a>
                            </div>
                        )}
                        {!isLoading && !editedImage && (
                            <div className="text-center text-gray-400">
                                <p>Tu imagen editada aparecerá aquí</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                     <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ej: Añade un filtro retro, haz que el cielo sea morado"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none h-24"
                        disabled={isLoading || !originalImage}
                    />
                    <button
                        onClick={handleEdit}
                        disabled={isLoading || !originalImage || !prompt.trim()}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-lg flex items-center justify-center hover:bg-red-700 disabled:bg-gray-500 transition duration-200"
                    >
                        {isLoading ? <><LoadingSpinner /> Editando...</> : 'Aplicar Edición'}
                    </button>
                </div>

                {error && <div className="mt-6 p-3 text-center text-red-300 bg-red-900/50 rounded-lg">{error}</div>}
            </div>
        </div>
    );
};

export default ImageEditor;
