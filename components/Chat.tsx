import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ChatMode, ChatSession } from '../types';
import { generateChatResponse, generateSpeech } from '../services/geminiService';
import { LoadingSpinner, SendIcon, SoundIcon, PaperclipIcon, XCircleIcon } from './icons';
import { decode, decodeAudioData, fileToBase64, extractFramesFromVideo } from '../utils/helpers';
import HistorySidebar from './HistorySidebar';
import { Part } from '@google/genai';

const CHAT_SESSIONS_KEY = 'arens_ia_chat_sessions';

const createNewSession = (mode: ChatMode = ChatMode.STANDARD): ChatSession => ({
    id: crypto.randomUUID(),
    title: 'Nueva Conversación',
    messages: [{ id: crypto.randomUUID(), sender: 'ai', text: `¡Hola! Soy Arens IA en modo ${mode}. ¿Cómo puedo ayudarte hoy?` }],
    history: [],
    mode: mode,
    createdAt: Date.now(),
});

const Chat: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load sessions from localStorage on initial render
    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
            const parsedSessions: ChatSession[] = savedSessions ? JSON.parse(savedSessions) : [];
            if (parsedSessions.length > 0) {
                parsedSessions.sort((a, b) => b.createdAt - a.createdAt);
                setSessions(parsedSessions);
                setActiveSessionId(parsedSessions[0].id);
            } else {
                const newSession = createNewSession();
                setSessions([newSession]);
                setActiveSessionId(newSession.id);
            }
        } catch (e) {
            console.error("Failed to load sessions from localStorage", e);
            const newSession = createNewSession();
            setSessions([newSession]);
            setActiveSessionId(newSession.id);
        }
    }, []);

    // Save sessions to localStorage whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
        } else {
            localStorage.removeItem(CHAT_SESSIONS_KEY);
        }
    }, [sessions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeSessionId, sessions]);
    
    const activeSession = sessions.find(s => s.id === activeSessionId);

    useEffect(() => {
        if (activeSession?.mode === ChatMode.MAPS_SEARCH && !location) {
            navigator.geolocation.getCurrentPosition(
                (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
                (err) => {
                    setError('No se pudo obtener la ubicación. Por favor, activa los servicios de localización.');
                    console.error(err);
                }
            );
        }
    }, [activeSession?.mode, location]);

    const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
        setSessions(prevSessions =>
            prevSessions.map(s => s.id === sessionId ? { ...s, ...updates } : s)
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                setError('Tipo de archivo no soportado. Por favor, sube una imagen o un video.');
                return;
            }
            if (file.size > 20 * 1024 * 1024) { // 20MB limit
                setError('El archivo es demasiado grande. El límite es de 20MB.');
                return;
            }
            setAttachedFile(file);
            setMediaPreviewUrl(URL.createObjectURL(file));
            setError(null);
        }
        e.target.value = '';
    };

    const handleRemoveAttachment = () => {
        if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
        setAttachedFile(null);
        setMediaPreviewUrl(null);
    };

    const handleSend = async () => {
        if ((!input.trim() && !attachedFile) || isLoading || !activeSession) return;

        const textToSend = input.trim();
        const fileToSend = attachedFile;
        const previewUrlToSend = mediaPreviewUrl;
        
        const userMessage: Message = { 
            id: crypto.randomUUID(), 
            sender: 'user', 
            text: textToSend,
            mediaUrl: previewUrlToSend,
            mediaType: fileToSend?.type
        };

        const updatedMessages = [...activeSession.messages, userMessage];
        const isFirstUserMessage = activeSession.messages.filter(m => m.sender === 'user').length === 0;

        updateSession(activeSession.id, {
             messages: updatedMessages,
             ...(isFirstUserMessage && { title: (textToSend || "Análisis de Medios").substring(0, 40) })
        });
        
        setInput('');
        handleRemoveAttachment();
        setIsLoading(true);
        setError(null);

        try {
            let mediaParts: Part[] | undefined = undefined;

            if (fileToSend) {
                if (fileToSend.type.startsWith('image/')) {
                    const base64Data = await fileToBase64(fileToSend);
                    mediaParts = [{ inlineData: { data: base64Data, mimeType: fileToSend.type } }];
                } else if (fileToSend.type.startsWith('video/')) {
                    const frames = await extractFramesFromVideo(fileToSend, 1); // 1 FPS
                    if (frames.length > 0) {
                        mediaParts = frames.map(frame => ({ inlineData: { data: frame, mimeType: 'image/jpeg' } }));
                    } else {
                        throw new Error("No se pudieron extraer fotogramas del video.");
                    }
                }
            }

            const response = await generateChatResponse(textToSend, activeSession.history, activeSession.mode, location, mediaParts);
            const aiMessage: Message = { id: crypto.randomUUID(), sender: 'ai', text: response.text, sources: response.sources };
            
            const userTurnParts: Part[] = [{ text: textToSend }];
            if (mediaParts) {
                userTurnParts.push(...mediaParts);
            }

            updateSession(activeSession.id, {
                messages: [...updatedMessages, aiMessage],
                history: [
                    ...activeSession.history,
                    { role: 'user', parts: userTurnParts },
                    { role: 'model', parts: [{ text: response.text }] },
                ],
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(errorMessage);
            const errorAiMessage: Message = { id: crypto.randomUUID(), sender: 'ai', text: `Lo siento, ocurrió un error: ${errorMessage}` };
            updateSession(activeSession.id, {
                messages: [...updatedMessages, errorAiMessage]
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const playTTS = useCallback(async (text: string) => {
        try {
            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const audioContext = audioContextRef.current;
            const base64Audio = await generateSpeech(text);
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
        } catch(err) {
            setError(err instanceof Error ? `Error de TTS: ${err.message}` : 'Ocurrió un error de TTS desconocido.');
        }
    }, []);

    const handleModeChange = (newMode: ChatMode) => {
        if (!activeSession || activeSession.mode === newMode) return;
        const resetMessages: Message[] = [{ id: crypto.randomUUID(), sender: 'ai', text: `Cambiado al modo ${newMode}. ¿Cómo puedo ayudar?` }];
        updateSession(activeSession.id, { mode: newMode, messages: resetMessages, history: [] });
    };
    
    const handleNewChat = () => {
        const newSession = createNewSession(activeSession?.mode);
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
    };

    const handleDeleteChat = (idToDelete: string) => {
        const remainingSessions = sessions.filter(s => s.id !== idToDelete);
        if (activeSessionId === idToDelete) {
            if (remainingSessions.length > 0) setActiveSessionId(remainingSessions[0].id);
            else {
                const newSession = createNewSession();
                setSessions([newSession]);
                setActiveSessionId(newSession.id);
                return; 
            }
        }
        setSessions(remainingSessions);
    };

    const sortedSessions = [...sessions].sort((a, b) => b.createdAt - a.createdAt);

    return (
        <div className="flex h-full bg-gray-900 text-white">
            <HistorySidebar sessions={sortedSessions} activeSessionId={activeSessionId} onNewChat={handleNewChat} onSelectChat={setActiveSessionId} onDeleteChat={handleDeleteChat} />
            <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-700 bg-gray-800">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-300 mr-2">Modo:</span>
                        {Object.values(ChatMode).map(m => (
                            <button key={m} onClick={() => handleModeChange(m)} className={`px-3 py-1 text-xs rounded-full transition ${activeSession?.mode === m ? 'bg-red-600 text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {activeSession?.messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-lg lg:max-w-2xl px-4 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-red-600' : 'bg-gray-800'}`}>
                                    {msg.mediaUrl && (
                                        <div className="mb-2">
                                            {msg.mediaType?.startsWith('image/') ? (
                                                <img src={msg.mediaUrl} alt="Adjunto de usuario" className="rounded-lg max-h-48 w-auto" />
                                            ) : (
                                                <video src={msg.mediaUrl} controls className="rounded-lg max-h-48 w-auto" />
                                            )}
                                        </div>
                                    )}
                                    {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                                    {msg.sender === 'ai' && msg.text && (
                                        <div className="mt-2 flex items-center justify-between">
                                            <button onClick={() => playTTS(msg.text)} className="text-gray-400 hover:text-white transition" aria-label="Escuchar mensaje"><SoundIcon className="h-5 w-5"/></button>
                                            {msg.sources && msg.sources.length > 0 && (
                                                <div className="text-xs text-gray-400 ml-4">
                                                    <h4 className="font-bold">Fuentes:</h4>
                                                    <ul className="list-disc list-inside">
                                                        {msg.sources.map((source, i) => (<li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{source.title || source.uri}</a></li>))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
                {error && <div className="p-4 text-center text-red-400 bg-red-900/50">{error}</div>}
                <div className="p-4 border-t border-gray-700 bg-gray-800">
                    {mediaPreviewUrl && (
                        <div className="relative w-24 h-24 mb-2 p-1 bg-gray-700 rounded-lg">
                            {attachedFile?.type.startsWith('image/') ? (
                                <img src={mediaPreviewUrl} alt="Preview" className="w-full h-full object-cover rounded" />
                            ) : (
                                <video src={mediaPreviewUrl} className="w-full h-full object-cover rounded" />
                            )}
                            <button onClick={handleRemoveAttachment} className="absolute -top-2 -right-2 bg-gray-800 rounded-full text-white hover:text-red-500 transition-colors">
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>
                    )}
                    <div className="relative flex items-center">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-white transition rounded-full hover:bg-gray-700" aria-label="Adjuntar archivo">
                            <PaperclipIcon className="w-6 h-6" />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Escribe un mensaje o adjunta un archivo..."
                            className="w-full bg-gray-700 text-white rounded-full py-3 pl-4 pr-16 focus:outline-none focus:ring-2 focus:ring-red-500"
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading || (!input.trim() && !attachedFile)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:bg-gray-500 transition">
                            {isLoading ? <LoadingSpinner /> : <SendIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;