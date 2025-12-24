
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getLiveSession } from '../services/geminiService';
import { decode, decodeAudioData, encode } from '../utils/helpers';
import { MicIcon, TrashIcon, SoundIcon } from './icons';
import { LiveServerMessage, Modality, Blob } from '@google/genai';

const availableVoices = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const;
type VoiceName = typeof availableVoices[number];

const LiveConversation: React.FC = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [voice, setVoice] = useState<VoiceName>('Zephyr');
    const [visualizerData, setVisualizerData] = useState<number[]>(new Array(20).fill(10));
    const [isInterrupted, setIsInterrupted] = useState(false);
    const [captions, setCaptions] = useState('');
    
    const sessionRef = useRef<any>(null);
    const inputCtx = useRef<AudioContext | null>(null);
    const outputCtx = useRef<AudioContext | null>(null);
    const processor = useRef<ScriptProcessorNode | null>(null);
    const nextStartTime = useRef(0);
    const activeSources = useRef<Set<AudioBufferSourceNode>>(new Set());
    const captionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Simple visualizer simulation
    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => {
            if (isInterrupted) {
                setVisualizerData(new Array(20).fill(5));
            } else {
                setVisualizerData(new Array(20).fill(0).map(() => Math.max(5, Math.random() * 100)));
            }
        }, 100);
        return () => clearInterval(interval);
    }, [isActive, isInterrupted]);

    const stop = useCallback(() => {
        try {
            sessionRef.current?.close();
        } catch (e) {
            console.warn("Session already closed or error closing:", e);
        }
        sessionRef.current = null;
        
        // Robust AudioContext closing
        if (inputCtx.current && inputCtx.current.state !== 'closed') {
            inputCtx.current.close().catch(e => console.error("Error closing inputCtx:", e));
        }
        inputCtx.current = null;

        if (outputCtx.current && outputCtx.current.state !== 'closed') {
            outputCtx.current.close().catch(e => console.error("Error closing outputCtx:", e));
        }
        outputCtx.current = null;
        
        activeSources.current.forEach(source => {
            try { source.stop(); } catch (e) {}
        });
        activeSources.current.clear();
        
        if (captionTimeoutRef.current) {
            clearTimeout(captionTimeoutRef.current);
            captionTimeoutRef.current = null;
        }
        
        setIsActive(false);
        setIsConnecting(false);
        setVisualizerData(new Array(20).fill(10));
        setCaptions('');
    }, []);

    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    const start = async () => {
        if (isActive || isConnecting) return;
        setIsConnecting(true); setError(null); setCaptions('');
        
        try {
            // Verificar clave de API antes de conectar
            if (window.aistudio) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    await window.aistudio.openSelectKey();
                }
            }

            const live = getLiveSession();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const promise = live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false); setIsActive(true);
                        inputCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        outputCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        nextStartTime.current = 0;
                        
                        const src = inputCtx.current.createMediaStreamSource(stream);
                        processor.current = inputCtx.current.createScriptProcessor(4096, 1, 1);
                        processor.current.onaudioprocess = (e) => {
                            if (!sessionRef.current) return;
                            const data = e.inputBuffer.getChannelData(0);
                            const blob = { data: encode(new Uint8Array(new Int16Array(data.map(x => x * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionRef.current.sendRealtimeInput({ media: blob });
                        };
                        src.connect(processor.current);
                        processor.current.connect(inputCtx.current.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const serverContent = msg.serverContent;

                        if (serverContent?.outputTranscription?.text) {
                            if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
                            setCaptions(prev => prev + serverContent.outputTranscription!.text);
                        }

                        if (serverContent?.turnComplete) {
                            if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
                            captionTimeoutRef.current = setTimeout(() => {
                                setCaptions('');
                            }, 5000);
                        }

                        if (serverContent?.interrupted) {
                            setIsInterrupted(true);
                            setCaptions('');
                            if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
                            
                            setTimeout(() => setIsInterrupted(false), 500);

                            activeSources.current.forEach((source) => {
                                try { source.stop(); } catch (e) {}
                            });
                            activeSources.current.clear();
                            nextStartTime.current = 0;
                            return;
                        }

                        const audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audio && outputCtx.current && outputCtx.current.state !== 'closed') {
                            if (nextStartTime.current === 0) {
                                nextStartTime.current = outputCtx.current.currentTime;
                            }
                            nextStartTime.current = Math.max(nextStartTime.current, outputCtx.current.currentTime);

                            const buf = await decodeAudioData(decode(audio), outputCtx.current, 24000, 1);
                            const src = outputCtx.current.createBufferSource();
                            src.buffer = buf;
                            src.connect(outputCtx.current.destination);
                            
                            activeSources.current.add(src);
                            src.onended = () => {
                                activeSources.current.delete(src);
                            };

                            src.start(nextStartTime.current);
                            nextStartTime.current += buf.duration;
                        }
                    },
                    onclose: stop,
                    onerror: async (e: any) => { 
                        console.error("Live Error:", e);
                        if (e.message?.includes("403") || e.message?.toLowerCase().includes("permission")) {
                             if(window.aistudio) await window.aistudio.openSelectKey();
                             setError("Error de permisos. He abierto el selector de llaves 🧐🍷.");
                        } else {
                             setError(e.message || "Error de conexión");
                        }
                        stop(); 
                    }
                },
                config: { 
                    responseModalities: [Modality.AUDIO], 
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                    outputAudioTranscription: {} 
                }
            });
            sessionRef.current = await promise;
        } catch (e: any) { 
            setError(e.message); 
            setIsConnecting(false); 
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center bg-black relative overflow-hidden">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] blur-[100px] md:blur-[150px] rounded-full transition-all duration-500 ${isActive ? (isInterrupted ? 'bg-orange-500/40' : 'bg-red-600/30') : 'bg-red-600/5 opacity-20'}`}></div>

            <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4 md:px-8 h-full justify-between py-8 md:py-20">
                
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    <div className="flex flex-wrap justify-center gap-2 mb-10 md:mb-16 w-full">
                        {availableVoices.map(v => (
                            <button key={v} onClick={() => setVoice(v)} disabled={isActive} className={`px-4 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-full transition-all border ${voice === v ? 'bg-white text-black border-white shadow-lg shadow-white/10' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}>
                                {v}
                            </button>
                        ))}
                    </div>

                    <div className="h-24 md:h-40 flex items-end gap-1.5 md:gap-2 mb-12 md:mb-20">
                        {visualizerData.map((h, i) => (
                            <div key={i} className={`w-2 md:w-4 rounded-t-full transition-all duration-75 ${isInterrupted ? 'bg-orange-500' : 'bg-gradient-to-t from-red-600 to-red-400'}`} style={{ height: isActive ? `${Math.max(12, h)}%` : '12%', opacity: isActive ? 1 : 0.3 }}></div>
                        ))}
                    </div>

                    <button
                        onClick={isActive ? stop : start}
                        disabled={isConnecting}
                        className={`w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative group ${isActive ? 'bg-white text-red-600 scale-110' : 'bg-red-600 text-white hover:scale-105 shadow-red-900/40'}`}
                    >
                        {isActive && <div className="absolute inset-[-8px] border-2 border-white/20 rounded-full animate-ping"></div>}
                        {isConnecting ? <div className="animate-spin w-8 h-8 md:w-10 md:h-10 border-4 border-red-600 border-t-transparent rounded-full"></div> : <MicIcon className="w-10 h-10 md:w-12 md:h-12" />}
                    </button>

                    <div className="mt-8 md:mt-10 flex flex-col items-center gap-3">
                        <p className="text-zinc-400 font-medium tracking-widest uppercase text-xs md:text-sm text-center">
                            {isConnecting ? 'Conectando...' : isActive ? (isInterrupted ? 'Escuchando...' : 'En vivo con Arens IA') : 'Presiona para conversar'}
                        </p>
                        {isActive && <p className="text-[10px] md:text-xs text-zinc-600 font-medium uppercase tracking-tight text-center">Puedes interrumpir en cualquier momento 🍷🧐</p>}
                    </div>

                    {error && (
                        <div className="mt-6 text-red-500 bg-red-950/20 px-6 py-3 rounded-xl border border-red-900/30 text-xs md:text-sm text-center animate-fadeIn max-w-sm">
                            {error}
                        </div>
                    )}
                </div>

                <div className="w-full flex items-end justify-center min-h-[100px] md:min-h-[140px] shrink-0 z-20 pb-4 md:pb-0">
                    {isActive && captions && (
                         <div className="text-center animate-fadeIn transition-all duration-300 ease-out w-full max-w-3xl bg-black/70 backdrop-blur-xl p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-2xl max-h-[35vh] md:max-h-[40vh] overflow-y-auto custom-scrollbar">
                            <p className="text-lg md:text-3xl font-semibold text-white/95 leading-snug md:leading-relaxed whitespace-pre-wrap tracking-tight">
                                {captions}
                                <span className="inline-block w-2 h-6 md:w-2.5 md:h-8 ml-2 align-middle bg-red-500 animate-pulse rounded-full"></span>
                            </p>
                         </div>
                    )}
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
};

export default LiveConversation;
