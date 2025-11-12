// FIX: Add type definitions for the Web Speech API to resolve 'SpeechRecognition' not found error.
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
    item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: () => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    start(): void;
    stop(): void;
}

declare var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ChatMode, ChatSession, Attachment } from '../types';
import { generateChatResponse, generateSpeech } from '../services/geminiService';
import { LoadingSpinner, SendIcon, SoundIcon, PaperclipIcon, XCircleIcon, FileIcon, AudioFileIcon, MicIcon, MenuIcon } from './icons';
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

// FIX: Define props type for AttachmentPreview to correctly type the component.
type AttachmentPreviewProps = {
    attachment: Attachment;
    onRemove: () => void;
};

// FIX: Explicitly type AttachmentPreview as a React.FC to correctly handle React's special `key` prop.
const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, onRemove }) => {
    const renderContent = () => {
        if (attachment.type.startsWith('image/')) {
            return <img src={attachment.url} alt={attachment.name} className="w-full h-full object-cover rounded" />;
        }
        if (attachment.type.startsWith('video/')) {
            return <video src={attachment.url} className="w-full h-full object-cover rounded" />;
        }
        if (attachment.type.startsWith('audio/')) {
            return <div className="w-full h-full flex flex-col items-center justify-center bg-gray-600 rounded"><AudioFileIcon className="w-8 h-8 text-gray-300" /><span className="text-xs text-center text-gray-300 mt-1 truncate px-1">{attachment.name}</span></div>;
        }
        return <div className="w-full h-full flex flex-col items-center justify-center bg-gray-600 rounded"><FileIcon className="w-8 h-8 text-gray-300" /><span className="text-xs text-center text-gray-300 mt-1 truncate px-1">{attachment.name}</span></div>;
    };
    return (
        <div className="relative w-24 h-24 p-1 bg-gray-700 rounded-lg">
            {renderContent()}
            <button onClick={onRemove} className="absolute -top-2 -right-2 bg-gray-800 rounded-full text-white hover:text-red-500 transition-colors">
                <XCircleIcon className="w-6 h-6" />
            </button>
        </div>
    );
};

const MessageAttachments = ({ attachments, sender }: { attachments: Attachment[], sender: 'user' | 'ai' }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {attachments.map((att, index) => {
                const sizeClass = sender === 'user' ? 'w-32 h-32' : 'w-48 h-48';
                if (att.type.startsWith('image/')) {
                    return <img key={index} src={att.url} alt={att.name} className={`${sizeClass} object-cover rounded-lg`} />;
                }
                if (att.type.startsWith('video/')) {
                    return <video key={index} src={att.url} controls className={`${sizeClass} object-cover rounded-lg`} />;
                }
                if (att.type.startsWith('audio/')) {
                    return (
                        <div key={index} className="bg-gray-700 p-2 rounded-lg flex flex-col items-center justify-center text-center">
                            <AudioFileIcon className="w-8 h-8 mb-2" />
                            <span className="text-xs break-all">{att.name}</span>
                            <audio src={att.url} controls className="w-full mt-2" />
                        </div>
                    );
                }
                return (
                     <a key={index} href={att.url} target="_blank" rel="noopener noreferrer" className="bg-gray-700 p-2 rounded-lg flex flex-col items-center justify-center text-center hover:bg-gray-600">
                        <FileIcon className="w-8 h-8 mb-2" />
                        <span className="text-xs break-all">{att.name}</span>
                    </a>
                );
            })}
        </div>
    );
};


const Chat: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [mediaPreviews, setMediaPreviews] = useState<Attachment[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const baseTextRef = useRef('');

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
    
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("El reconocimiento de voz no es compatible con este navegador.");
            return;
        }
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        recognition.onstart = () => setIsRecording(true);
        recognition.onend = () => setIsRecording(false);
        // FIX: Add explicit type for the event parameter for better type safety.
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Error de reconocimiento de voz', event.error);
            setError(`Error de reconocimiento de voz: ${event.error}`);
            setIsRecording(false);
        };

        // FIX: Add explicit type for the event parameter for better type safety.
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if(finalTranscript) {
                baseTextRef.current = baseTextRef.current + finalTranscript;
            }
            setInput(baseTextRef.current + interimTranscript);
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
        };
    }, []);

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
    
    // Cleanup object URLs
    useEffect(() => {
        return () => {
            mediaPreviews.forEach(preview => URL.revokeObjectURL(preview.url));
        }
    }, [mediaPreviews]);

    const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
        setSessions(prevSessions =>
            prevSessions.map(s => s.id === sessionId ? { ...s, ...updates } : s)
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files);
            // FIX: Explicitly type 'file' as File to resolve unknown type errors.
            const validFiles = newFiles.filter((file: File) => {
                 if (file.size > 20 * 1024 * 1024) { // 20MB limit
                    setError(`El archivo ${file.name} es demasiado grande. El límite es de 20MB.`);
                    return false;
                }
                return true;
            });
            
            setAttachedFiles(prev => [...prev, ...validFiles]);
            
            // FIX: Explicitly type 'file' as File to resolve unknown type errors.
            const newPreviews = validFiles.map((file: File) => ({
                name: file.name,
                type: file.type,
                url: URL.createObjectURL(file)
            }));
            setMediaPreviews(prev => [...prev, ...newPreviews]);
            
            setError(null);
        }
        e.target.value = '';
    };

    const handleRemoveAttachment = (indexToRemove: number) => {
        URL.revokeObjectURL(mediaPreviews[indexToRemove].url);
        setAttachedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
        setMediaPreviews(prev => prev.filter((_, i) => i !== indexToRemove));
    };
    
    const handleToggleRecording = () => {
        if (!recognitionRef.current) return;
        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            baseTextRef.current = input;
            recognitionRef.current.start();
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || isLoading || !activeSession) return;

        const userMessage: Message = { 
            id: crypto.randomUUID(), 
            sender: 'user', 
            text: input.trim(),
            attachments: mediaPreviews,
        };
        
        const updatedMessages = [...activeSession.messages, userMessage];
        const isFirstUserMessage = activeSession.messages.filter(m => m.sender === 'user').length === 0;
        
        updateSession(activeSession.id, {
             messages: updatedMessages,
             ...(isFirstUserMessage && { title: (input.trim() || "Análisis de Medios").substring(0, 40) })
        });
        
        const filesToSend = [...attachedFiles];
        setInput('');
        setAttachedFiles([]);
        setMediaPreviews([]);
        setIsLoading(true);
        setError(null);
        
        try {
            let mediaParts: Part[] = [];
            for (const file of filesToSend) {
                if (file.type.startsWith('video/')) {
                    const frames = await extractFramesFromVideo(file, 1);
                    if (frames.length > 0) {
                        mediaParts.push(...frames.map(frame => ({ inlineData: { data: frame, mimeType: 'image/jpeg' } })));
                    }
                } else {
                    const base64Data = await fileToBase64(file);
                    mediaParts.push({ inlineData: { data: base64Data, mimeType: file.type } });
                }
            }

            const { text, sources, mediaUrl, mediaType, historyParts } = await generateChatResponse(userMessage.text, activeSession.history, activeSession.mode, location, mediaParts);
            
            const aiAttachments: Attachment[] = [];
            if (mediaUrl && mediaType) {
                aiAttachments.push({ name: 'Generated Content', type: mediaType, url: mediaUrl });
            }

            const aiMessage: Message = { 
                id: crypto.randomUUID(), 
                sender: 'ai', 
                text, 
                sources,
                attachments: aiAttachments,
            };
            
            const userTurnParts: Part[] = [{ text: userMessage.text }];
            if (mediaParts.length > 0) {
                userTurnParts.push(...mediaParts);
            }

            updateSession(activeSession.id, {
                messages: [...updatedMessages, aiMessage],
                history: [
                    ...activeSession.history,
                    { role: 'user', parts: userTurnParts },
                    { role: 'model', parts: historyParts },
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
        <div className="flex h-full bg-gray-900 text-white relative overflow-hidden">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                ></div>
            )}
            <HistorySidebar
                sessions={sortedSessions}
                activeSessionId={activeSessionId}
                onNewChat={handleNewChat}
                onSelectChat={setActiveSessionId}
                onDeleteChat={handleDeleteChat}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 border-b border-gray-700 bg-gray-800">
                    <div className="flex items-center justify-between">
                        <button
                            className="p-2 rounded-md text-gray-300 hover:bg-gray-700 md:hidden"
                            onClick={() => setIsSidebarOpen(true)}
                            aria-label="Abrir historial de chats"
                        >
                            <MenuIcon className="h-6 w-6" />
                        </button>
                        <div className="flex items-center justify-center gap-2 flex-wrap flex-1">
                            <span className="text-sm font-medium text-gray-300 mr-2 hidden sm:inline">Modo:</span>
                            {Object.values(ChatMode).map(m => (
                                <button key={m} onClick={() => handleModeChange(m)} className={`px-3 py-1 text-xs rounded-full transition ${activeSession?.mode === m ? 'bg-red-600 text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                        <div className="w-10 md:hidden" aria-hidden="true"></div>
                    </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {activeSession?.messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-lg lg:max-w-2xl px-4 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-red-600' : 'bg-gray-800'}`}>
                                    {(msg.attachments && msg.attachments.length > 0) && (
                                        <MessageAttachments attachments={msg.attachments} sender={msg.sender}/>
                                    )}
                                    {/* For backward compatibility */}
                                    {msg.mediaUrl && (!msg.attachments || msg.attachments.length === 0) && (
                                        <div className="mb-2">
                                            {msg.mediaType?.startsWith('image/') ? (
                                                <img src={msg.mediaUrl} alt="Media" className="rounded-lg max-h-96" />
                                            ) : (
                                                <video src={msg.mediaUrl} controls className="rounded-lg max-h-96" />
                                            )}
                                        </div>
                                    )}
                                    {msg.text && <p className="whitespace-pre-wrap mt-2">{msg.text}</p>}
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
                    {mediaPreviews.length > 0 && (
                        <div className="mb-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2">
                            {mediaPreviews.map((preview, index) => (
                                <AttachmentPreview 
                                    key={index}
                                    attachment={preview}
                                    onRemove={() => handleRemoveAttachment(index)}
                                />
                            ))}
                        </div>
                    )}
                    <div className="relative flex items-center">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.md" multiple className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-white transition rounded-full hover:bg-gray-700" aria-label="Adjuntar archivo">
                            <PaperclipIcon className="w-6 h-6" />
                        </button>
                         <button onClick={handleToggleRecording} className={`p-3 text-gray-400 hover:text-white transition rounded-full hover:bg-gray-700 ${isRecording ? 'animate-pulse' : ''}`} aria-label="Usar micrófono">
                            <MicIcon className={`w-6 h-6 ${isRecording ? 'text-red-500' : ''}`} />
                        </button>
                        <textarea
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                            placeholder="Escribe un mensaje o adjunta archivos..."
                            className="w-full bg-gray-700 text-white rounded-2xl py-3 pl-4 pr-16 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none max-h-40"
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachedFiles.length === 0)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:bg-gray-500 transition">
                            {isLoading ? <LoadingSpinner /> : <SendIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;