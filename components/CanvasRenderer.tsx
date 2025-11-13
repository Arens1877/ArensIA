import React, { useState } from 'react';
import { CopyIcon } from './icons';

interface CanvasRendererProps {
    code: string;
}

const CanvasRenderer: React.FC<CanvasRendererProps> = ({ code }) => {
    const [copySuccess, setCopySuccess] = useState('');

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopySuccess('¡Copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('Error al copiar');
        });
    };

    // El contenido HTML completo ahora se pasa directamente en la propiedad 'code'.
    const srcDoc = code;

    return (
        <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden bg-gray-800">
            {/* Preview */}
            <div className="p-2">
                <h4 className="text-sm font-semibold text-gray-400 mb-2 px-2">Vista Previa</h4>
                <div className="relative aspect-video w-full bg-white rounded">
                     <iframe
                        srcDoc={srcDoc}
                        title="Canvas Preview"
                        sandbox="allow-scripts"
                        width="100%"
                        height="100%"
                        className="absolute top-0 left-0 w-full h-full border-0 rounded"
                        loading="lazy"
                    />
                </div>
            </div>
            {/* Code */}
            <div className="p-2 relative">
                 <div className="flex justify-between items-center mb-1 px-2">
                    <h4 className="text-sm font-semibold text-gray-400">Código Fuente</h4>
                    <button onClick={handleCopyCode} className="flex items-center text-xs text-gray-400 hover:text-white transition-colors">
                        <CopyIcon className="w-4 h-4 mr-1" />
                        {copySuccess || 'Copiar Código'}
                    </button>
                </div>
                <pre className="bg-black p-3 rounded-md text-sm overflow-x-auto text-yellow-300 max-h-60">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    );
};

export default CanvasRenderer;