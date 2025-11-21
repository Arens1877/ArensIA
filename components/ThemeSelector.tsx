
import React from 'react';
import { themes, useTheme } from '../contexts/ThemeContext';
import { XIcon, PaletteIcon } from './icons';

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isOpen, onClose }) => {
  const { currentTheme, setTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col relative animate-scaleIn">
        
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
             <div className="flex items-center gap-2">
                 <PaletteIcon className={`w-5 h-5 ${currentTheme.colors.text}`} />
                 <h2 className="text-xl font-bold text-white">Personalización</h2>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <XIcon className="w-6 h-6" />
             </button>
        </div>

        <div className="p-6 grid gap-4">
            <p className="text-sm text-zinc-400 mb-2">Elige el estilo visual de Arens IA:</p>
            <div className="grid grid-cols-1 gap-3">
                {themes.map((theme) => (
                    <button
                        key={theme.id}
                        onClick={() => setTheme(theme.id)}
                        className={`flex items-center p-3 rounded-xl border transition-all active:scale-95 ${
                            currentTheme.id === theme.id 
                            ? `${theme.colors.secondary} ${theme.colors.border} ring-1 ${theme.colors.ring}` 
                            : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-full ${theme.colors.userBubble} shadow-lg mr-4 flex items-center justify-center border border-white/10`}>
                           <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
                        </div>
                        <div className="text-left">
                            <h3 className={`font-medium ${currentTheme.id === theme.id ? 'text-white' : 'text-zinc-300'}`}>{theme.name}</h3>
                        </div>
                        {currentTheme.id === theme.id && (
                            <div className={`ml-auto w-3 h-3 rounded-full ${theme.colors.primary}`}></div>
                        )}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="p-4 bg-black/20 border-t border-white/5 text-center">
            <button onClick={onClose} className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-all text-sm">
                Listo
            </button>
        </div>

      </div>
    </div>
  );
};

export default ThemeSelector;
