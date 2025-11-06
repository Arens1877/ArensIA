import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getLiveSession } from '../services/geminiService';
import { decode, decodeAudioData, encode } from '../utils/helpers';
import { MicIcon } from './icons';
import { LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';

const LiveConversation: React.FC = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<{ user?: string; model?: string }[]>([]);
    
    const sessionRef = useRef<LiveSession | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const stopConversation = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
             inputAudioContextRef.current.close();
             inputAudioContextRef.current = null;
        }
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        setIsActive(false);
        setIsConnecting(false);
    }, []);

    const startConversation = async () => {
        if (isActive || isConnecting) return;

        setIsConnecting(true);
        setError(null);
        setTranscripts([]);

        try {
            const live = getLiveSession();
            
            const sessionPromise = live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        setIsConnecting(false);
                        setIsActive(true);
                        
                        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        
                        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current;
                            const fullOutput = currentOutputTranscriptionRef.current;
                            setTranscripts(prev => [...prev, {user: fullInput, model: fullOutput}]);
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const outputAudioContext = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);
                            source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Error de la API Live:', e);
                        setError(`Ocurrió un error: ${e.message}`);
                        stopConversation();
                    },
                    onclose: () => {
                       stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al iniciar la conversación.');
            setIsConnecting(false);
        }
    };
    
    useEffect(() => {
      return () => {
        stopConversation();
      };
    }, [stopConversation]);

    return (
        <div className="p-4 md:p-8 text-white h-full flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-center mb-2 text-red-500">Conversación en Vivo</h2>
            <p className="text-center text-gray-400 mb-8">Habla directamente con la IA y obtén respuestas de voz instantáneas.</p>
            
            <div className="w-full max-w-2xl flex flex-col items-center">
                <button
                    onClick={isActive ? stopConversation : startConversation}
                    disabled={isConnecting}
                    className={`relative w-40 h-40 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-300
                        ${isActive ? 'bg-red-700 hover:bg-red-800 animate-pulse' : 'bg-red-600 hover:bg-red-700'}
                        disabled:bg-gray-500`}
                >
                    <MicIcon className="h-16 w-16"/>
                    <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping-slow opacity-50" style={{ animationPlayState: isActive ? 'running' : 'paused' }}></div>
                </button>
                <p className="mt-4 text-lg font-medium">
                    {isConnecting ? 'Conectando...' : (isActive ? 'Escuchando...' : 'Toca para Empezar')}
                </p>
                {error && <p className="mt-4 text-red-400">{error}</p>}
                
                <div className="mt-8 w-full h-64 overflow-y-auto bg-gray-800 rounded-lg p-4 space-y-2">
                    {transcripts.map((t, i) => (
                        <div key={i} className="text-sm">
                            {t.user && <p><span className="font-bold text-red-400">Tú:</span> {t.user}</p>}
                            {t.model && <p><span className="font-bold text-gray-300">IA:</span> {t.model}</p>}
                        </div>
                    ))}
                     {!transcripts.length && <p className="text-gray-500 text-center">La transcripción aparecerá aquí...</p>}
                </div>
            </div>
            <style jsx="true">{`
              @keyframes ping-slow {
                75%, 100% {
                  transform: scale(1.5);
                  opacity: 0;
                }
              }
              .animate-ping-slow {
                animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
              }
            `}</style>
        </div>
    );
};

export default LiveConversation;