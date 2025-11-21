
import React, { useState } from 'react';
import { ChatIcon, ImageIcon, VideoIcon, MicIcon, VisionIcon, XIcon } from './icons';

interface TutorialProps {
  onClose: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Bienvenido a Arens IA",
      description: "Tu asistente multimodal definitivo. Una suite completa de herramientas de IA diseñada para potenciar tu creatividad y productividad.",
      icon: <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30 mb-4 text-3xl font-bold text-white">A</div>,
      image: null
    },
    {
      title: "Chat Inteligente",
      description: "Conversa con diferentes modelos: estándar para rapidez, 'Pro' para razonamiento complejo, o busca en la web y mapas en tiempo real.",
      icon: <ChatIcon className="w-12 h-12 text-red-500 mb-4" />,
    },
    {
      title: "Estudio Visual",
      description: "Genera imágenes impresionantes, edita fotos existentes con comandos de texto o analiza el contenido de tus videos e imágenes.",
      icon: <div className="flex gap-4 mb-4"><ImageIcon className="w-10 h-10 text-red-400" /><VisionIcon className="w-10 h-10 text-red-600" /></div>,
    },
    {
      title: "Video & Live",
      description: "Crea videos cinematográficos con Veo o conversa por voz en tiempo real con baja latencia.",
      icon: <div className="flex gap-4 mb-4"><VideoIcon className="w-10 h-10 text-blue-400" /><MicIcon className="w-10 h-10 text-red-500" /></div>,
    },
    {
      title: "Todo listo",
      description: "Explora las pestañas en el menú para comenzar. ¡Disfruta de Arens IA!",
      icon: <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4"><span className="text-3xl">🚀</span></div>,
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col relative animate-scaleIn">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors p-2 z-10">
            <XIcon className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="p-8 flex flex-col items-center text-center min-h-[300px] justify-center">
            <div className="animate-scaleIn key={step}">
                {steps[step].icon}
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 animate-fadeIn key={step}-title">{steps[step].title}</h2>
            <p className="text-zinc-400 leading-relaxed animate-fadeIn key={step}-desc">
                {steps[step].description}
            </p>
        </div>

        {/* Footer / Controls */}
        <div className="p-6 bg-black/20 border-t border-white/5 flex items-center justify-between">
            {/* Indicators */}
            <div className="flex gap-2">
                {steps.map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-red-600' : 'w-2 bg-zinc-700'}`}
                    />
                ))}
            </div>

            <div className="flex gap-3">
                {step < steps.length - 1 && (
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-white transition-colors">
                        Saltar
                    </button>
                )}
                <button 
                    onClick={handleNext} 
                    className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-all active:scale-95 shadow-lg"
                >
                    {step === steps.length - 1 ? 'Empezar' : 'Siguiente'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
