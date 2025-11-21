
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
            // If interrupted, flatline briefly
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
            console.error("Error closing session:", e);
        }
        sessionRef.current = null;
        
        // Safely close Input Context
        if (inputCtx.current) {
            if (inputCtx.current.state !== 'closed') {
                inputCtx.current.close().catch(e => console.error("Error closing inputCtx:", e));
            }
            inputCtx.current = null;
        }

        // Safely close Output Context
        if (outputCtx.current) {
            if (outputCtx.current.state !== 'closed') {
                outputCtx.current.close().catch(e => console.error("Error closing outputCtx:", e));
            }
            outputCtx.current = null;
        }
        
        // Stop all playing audio
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    const start = async () => {
        if (isActive || isConnecting) return;
        setIsConnecting(true); setError(null); setCaptions('');
        try {
            const live = getLiveSession();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const promise = live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false); setIsActive(true);
                        inputCtx.current = new AudioContext({ sampleRate: 16000 });
                        outputCtx.current = new AudioContext({ sampleRate: 24000 });
                        nextStartTime.current = 0;
                        
                        const src = inputCtx.current.createMediaStreamSource(stream);
                        processor.current = inputCtx.current.createScriptProcessor(4096, 1, 1);
                        processor.current.onaudioprocess = (e) => {
                            const data = e.inputBuffer.getChannelData(0);
                            const blob = { data: encode(new Uint8Array(new Int16Array(data.map(x => x * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
                            promise.then(s => s.sendRealtimeInput({ media: blob }));
                        };
                        src.connect(processor.current);
                        processor.current.connect(inputCtx.current.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const serverContent = msg.serverContent;

                        // Handle Subtitles / Transcription
                        if (serverContent?.outputTranscription?.text) {
                            if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
                            setCaptions(prev => prev + serverContent.outputTranscription!.text);
                        }

                        // Handle Turn Complete (Clear captions after delay)
                        if (serverContent?.turnComplete) {
                            if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
                            captionTimeoutRef.current = setTimeout(() => {
                                setCaptions('');
                            }, 5000); // Keep readable for longer
                        }

                        // Handle Interruption
                        if (serverContent?.interrupted) {
                            console.log("Interrupción detectada (Barge-in)");
                            setIsInterrupted(true);
                            setCaptions(''); // Clear captions immediately on interrupt
                            if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
                            
                            setTimeout(() => setIsInterrupted(false), 500); // Reset visual flag

                            // Stop all currently playing audio
                            activeSources.current.forEach((source) => {
                                try { source.stop(); } catch (e) { console.error(e); }
                            });
                            activeSources.current.clear();
                            nextStartTime.current = 0;
                            return;
                        }

                        const audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audio && outputCtx.current) {
                            // If we reset due to interruption, start from current time
                            if (nextStartTime.current === 0) {
                                nextStartTime.current = outputCtx.current.currentTime;
                            }
                            // Ensure we don't schedule in the past
                            nextStartTime.current = Math.max(nextStartTime.current, outputCtx.current.currentTime);

                            const buf = await decodeAudioData(decode(audio), outputCtx.current, 24000, 1);
                            const src = outputCtx.current.createBufferSource();
                            src.buffer = buf;
                            src.connect(outputCtx.current.destination);
                            
                            // Track the source
                            activeSources.current.add(src);
                            src.onended = () => {
                                activeSources.current.delete(src);
                            };

                            src.start(nextStartTime.current);
                            nextStartTime.current += buf.duration;
                        }
                    },
                    onclose: stop,
                    onerror: (e) => { console.error(e); setError(e.message); stop(); }
                },
                config: { 
                    responseModalities: [Modality.AUDIO], 
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                    outputAudioTranscription: {} // Enable audio transcription from model
                }
            });
            sessionRef.current = await promise;
        } catch (e: any) { setError(e.message); setIsConnecting(false); }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center bg-black relative overflow-hidden">
            {/* Background Ambient Light */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] blur-[120px] rounded-full transition-all duration-300 ${isActive ? (isInterrupted ? 'bg-orange-500/30 scale-90' : 'bg-red-600/20 scale-100 opacity-100') : 'bg-red-600/5 opacity-20 scale-50'}`}></div>

            {/* Main Container with more width for subtitles */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-3xl px-6 h-full justify-between py-10 md:py-14">
                
                {/* Controls Section (Centered) */}
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
                    <div className="flex gap-2 mb-12">
                        {availableVoices.map(v => (
                            <button key={v} onClick={() => setVoice(v)} disabled={isActive} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-full transition-all border ${voice === v ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}>
                                {v}
                            </button>
                        ))}
                    </div>

                    {/* Visualizer */}
                    <div className="h-32 flex items-end gap-1 mb-12">
                        {visualizerData.map((h, i) => (
                            <div key={i} className={`w-3 rounded-t-full transition-all duration-75 ${isInterrupted ? 'bg-orange-500' : 'bg-gradient-to-t from-red-600 to-red-400'}`} style={{ height: isActive ? `${Math.max(10, h)}%` : '10%', opacity: isActive ? 1 : 0.3 }}></div>
                        ))}
                    </div>

                    <button
                        onClick={isActive ? stop : start}
                        disabled={isConnecting}
                        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${isActive ? 'bg-white text-red-600 scale-110 shadow-white/20' : 'bg-red-600 text-white hover:scale-105 shadow-red-900/50'}`}
                    >
                        {isConnecting ? <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full"></div> : <MicIcon className="w-10 h-10" />}
                    </button>

                    <div className="mt-8 flex flex-col items-center gap-2">
                        <p className="text-zinc-400 font-light tracking-wider uppercase text-sm">
                            {isConnecting ? 'Conectando...' : isActive ? (isInterrupted ? 'Escuchando...' : 'En vivo con Gemini') : 'Toca para hablar'}
                        </p>
                        {isActive && <p className="text-xs text-zinc-600">Puedes interrumpirme cuando quieras</p>}
                    </div>

                    {error && <div className="mt-4 text-red-500 bg-red-950/30 px-4 py-2 rounded-lg border border-red-900/50 text-sm">{error}</div>}
                </div>

                {/* Subtitles Area - Dynamic and Scrollable */}
                <div className="w-full flex items-end justify-center min-h-[60px]">
                    {isActive && captions && (
                         <div className="text-center animate-fadeIn transition-all duration-300 ease-out w-full max-w-3xl bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl max-h-[35vh] overflow-y-auto custom-scrollbar">
                            <p className="text-xl md:text-2xl font-medium text-white/90 drop-shadow-lg leading-relaxed whitespace-pre-wrap">
                                {captions}
                                <span className="inline-block w-2 h-6 ml-1 align-middle bg-red-500 animate-pulse rounded-full"></span>
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
