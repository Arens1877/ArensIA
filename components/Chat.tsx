
import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatMode, ChatSession, Attachment } from '../types';
import { generateChatResponse, generateSpeech } from '../services/geminiService';
import { LoadingSpinner, SendIcon, SoundIcon, PaperclipIcon, XCircleIcon, FileIcon, MicIcon, MenuIcon, CopyIcon, PauseIcon, TrashIcon, PlusIcon, LinkIcon, SparklesIcon, StarIcon, XIcon } from './icons';
import { decode, decodeAudioData, fileToBase64 } from '../utils/helpers';
import { Part } from '@google/genai';
import CanvasRenderer from './CanvasRenderer';
import { useTheme } from '../contexts/ThemeContext';

const CHAT_SESSIONS_KEY = 'arens_ia_chat_sessions';

const createNewSession = (mode: ChatMode = ChatMode.STANDARD): ChatSession => ({
    id: crypto.randomUUID(),
    title: 'Nueva Conversación',
    messages: [{ id: crypto.randomUUID(), sender: 'ai', text: `¡Hola! Soy Arens IA. Estoy lista para ayudarte en modo **${mode}**. ¿Qué necesitas? 🧐🍷` }],
    history: [],
    mode: mode,
    createdAt: Date.now(),
    isFavorite: false,
});

const AttachmentPreview: React.FC<{ attachment: Attachment; onRemove: () => void }> = ({ attachment, onRemove }) => {
    const isImage = attachment.type.startsWith('image/');
    const isUploading = attachment.status === 'uploading';
    const isError = attachment.status === 'error';

    return (
        <div className="relative w-16 h-16 md:w-20 md:h-20 group animate-scaleIn flex-shrink-0">
            {isImage ? (
                <img src={attachment.url} alt={attachment.name} className={`w-full h-full object-cover rounded-2xl border border-white/10 ${isUploading ? 'opacity-40 grayscale' : ''}`} />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 rounded-2xl border border-white/10">
                    <FileIcon className={`w-6 h-6 ${isUploading ? 'text-zinc-600' : 'text-zinc-400'}`} />
                    <span className="text-[8px] truncate w-full px-1 text-center text-zinc-500 mt-1">{attachment.name}</span>
                </div>
            )}
            
            {/* Progress Overlay */}
            {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 md:w-10 md:h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    {attachment.progress !== undefined && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-white">{Math.round(attachment.progress)}%</span>
                        </div>
                    )}
                </div>
            )}

            {/* Error Overlay */}
            {isError && (
                <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center rounded-2xl border border-red-500/50">
                    <XCircleIcon className="w-6 h-6 text-white" />
                </div>
            )}

            {/* Status Bar */}
            {isUploading && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700 rounded-full overflow-hidden mx-1 mb-1">
                    <div className="h-full bg-white transition-all duration-300" style={{ width: `${attachment.progress || 10}%` }}></div>
                </div>
            )}

            <button onClick={onRemove} className="absolute -top-2 -right-2 bg-zinc-900 border border-zinc-700 rounded-full p-1 text-zinc-400 hover:text-red-500 transition-colors shadow-lg active:scale-90 z-10 backdrop-blur-md">
                <XCircleIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

const getSmartSuggestions = (input: string): string[] => {
    const lower = input.toLowerCase().trim();
    
    // Si el input está vacío, sugerencias genéricas elegantes
    if (!lower) return [
        "Sorpréndeme 🧐", 
        "Crea una imagen 🎨", 
        "Búsqueda elegante 🍷", 
        "¿Qué puedes hacer?"
    ];

    // Sugerencias basadas en palabras clave específicas
    if (lower.includes('imagen') || lower.includes('dibuja') || lower.includes('foto')) {
        return ["Fotorrealista 4K 📷", "Cyberpunk neón 🌃", "Óleo renacentista 🖼️", "Logotipo minimalista"];
    }
    
    if (lower.includes('hola') || lower.includes('saludos') || lower.includes('buenos')) {
        return ["Saludos, Arens 🍷", "¿Cómo va tu día? 🧐", "Dime un dato curioso", "Hablemos de arte"];
    }

    if (lower.includes('codigo') || lower.includes('programar') || lower.includes('html') || lower.includes('crea')) {
        return ["Crea un botón CSS ✨", "Explica React ⚛️", "Refactoriza esto 🧐", "Algoritmo elegante"];
    }

    if (lower.includes('video') || lower.includes('peli') || lower.includes('cine')) {
        return ["Genera un video corto 🎬", "Recomienda cine clásico", "Guion cinematográfico", "Efectos visuales"];
    }

    if (lower.includes('donde') || lower.includes('lugar') || lower.includes('mapa') || lower.includes('cerca')) {
        return ["Restaurantes gourmet 🍷", "Monumentos en París 🗼", "Clima local 🧐", "Rutas turísticas"];
    }

    if (lower.includes('resumen') || lower.includes('lee') || lower.includes('texto')) {
        return ["Resume en puntos ✍️", "Análisis crítico 🧐", "Traduce al inglés 🍷", "Simplifica el texto"];
    }

    // Sugerencias por defecto si hay texto pero no coincide con categorías
    return [
        "Explica esto mejor 🧐", 
        "Resume con elegancia 🍷", 
        "¿Qué opinas tú?", 
        "Dame más detalles"
    ];
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
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [ttsState, setTtsState] = useState<{ messageId: string | null; status: 'PLAYING' | 'PAUSED' | 'LOADING' | 'STOPPED' }>({ messageId: null, status: 'STOPPED' });
    const [visibleCaptions, setVisibleCaptions] = useState<string>('');
    const [isListening, setIsListening] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    
    const { currentTheme } = useTheme();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const ttsSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const recognitionRef = useRef<any>(null);
    const captionIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem(CHAT_SESSIONS_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        if (parsed.length) { setSessions(parsed); setActiveSessionId(parsed[0].id); }
        else { const newS = createNewSession(); setSessions([newS]); setActiveSessionId(newS.id); }
    }, []);

    useEffect(() => {
        if (sessions.length) localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }, [sessions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [sessions, activeSessionId, isLoading]);

    // Actualización dinámica de sugerencias basándose en el input
    useEffect(() => { 
        setSuggestions(getSmartSuggestions(input)); 
    }, [input]);

    const activeSession = sessions.find(s => s.id === activeSessionId);

    const updateSession = (id: string, updates: Partial<ChatSession>) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files) as File[];
        
        const newPreviews: Attachment[] = newFiles.map(f => ({
            name: f.name,
            type: f.type,
            url: URL.createObjectURL(f),
            status: 'uploading',
            progress: 0
        }));

        setAttachedFiles(prev => [...prev, ...newFiles]);
        setMediaPreviews(prev => [...prev, ...newPreviews]);

        for (let i = 0; i < newPreviews.length; i++) {
            const index = mediaPreviews.length + i;
            let currentProgress = 0;
            const interval = setInterval(() => {
                currentProgress += Math.random() * 30;
                if (currentProgress >= 100) {
                    currentProgress = 100;
                    clearInterval(interval);
                    setMediaPreviews(prev => prev.map((p, idx) => 
                        idx === index ? { ...p, status: 'completed', progress: 100 } : p
                    ));
                } else {
                    setMediaPreviews(prev => prev.map((p, idx) => 
                        idx === index ? { ...p, progress: currentProgress } : p
                    ));
                }
            }, 100);
        }
    };

    const handleSend = async (textToSend?: string) => {
        const messageText = textToSend || input;
        const hasText = messageText.trim().length > 0;
        const hasFiles = attachedFiles.length > 0;

        if ((!hasText && !hasFiles) || isLoading || !activeSession) return;
        
        const newMessage: Message = { 
            id: crypto.randomUUID(), 
            sender: 'user', 
            text: messageText.trim(), 
            attachments: mediaPreviews.map(p => ({ ...p, status: 'completed' })) 
        };
        const currentFiles = [...attachedFiles];
        const updatedMessages = [...activeSession.messages, newMessage];
        
        setInput(''); 
        setAttachedFiles([]); 
        setMediaPreviews([]); 
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsLoading(true); 
        setError(null);

        updateSession(activeSession.id, { 
            messages: updatedMessages, 
            title: activeSession.messages.length <= 1 ? (messageText.substring(0, 30) || "Media Content") : activeSession.title 
        });

        try {
            const mediaParts: Part[] = [];
            for (const file of currentFiles) {
                const base64 = await fileToBase64(file);
                mediaParts.push({ inlineData: { data: base64, mimeType: file.type } });
            }

            if (activeSession.mode === ChatMode.MAPS_SEARCH && !location) {
                 await new Promise<void>((resolve) => {
                    navigator.geolocation.getCurrentPosition(p => {
                        setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude });
                        resolve();
                    }, () => resolve());
                 });
            }

            const res = await generateChatResponse(newMessage.text, activeSession.history, activeSession.mode, location, mediaParts);
            const aiMsg: Message = { id: crypto.randomUUID(), sender: 'ai', text: res.text, sources: res.sources, mediaUrl: res.mediaUrl, mediaType: res.mediaType, suggestions: res.suggestions };
            const userParts: Part[] = [{ text: newMessage.text }, ...mediaParts];
            updateSession(activeSession.id, { messages: [...updatedMessages, aiMsg], history: [...activeSession.history, { role: 'user', parts: userParts }, { role: 'model', parts: res.historyParts }] });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleListening = () => {
        if (isListening) { recognitionRef.current?.stop(); return; }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Su navegador no parece soportar el reconocimiento de voz. Una verdadera lástima 🧐🍷.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (e: any) => setInput(prev => (prev ? prev + ' ' : '') + e.results[0][0].transcript);
        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopCaptions = () => {
        if (captionIntervalRef.current) {
            window.clearInterval(captionIntervalRef.current);
            captionIntervalRef.current = null;
        }
        setVisibleCaptions('');
    };

    const startCaptions = (text: string, duration: number) => {
        stopCaptions();
        const words = text.split(' ');
        const totalWords = words.length;
        const timePerWord = (duration * 1000) / totalWords;
        let currentWordIndex = 0;

        captionIntervalRef.current = window.setInterval(() => {
            if (currentWordIndex < totalWords) {
                const start = Math.max(0, currentWordIndex - 4);
                setVisibleCaptions(words.slice(start, currentWordIndex + 1).join(' '));
                currentWordIndex++;
            } else {
                stopCaptions();
            }
        }, timePerWord);
    };

    const handleTts = async (id: string, text: string) => {
        if (ttsState.status === 'PLAYING' && ttsSourceNodeRef.current) {
            ttsSourceNodeRef.current.stop();
            setTtsState({ messageId: null, status: 'STOPPED' });
            stopCaptions();
            return;
        }
        setTtsState({ messageId: id, status: 'LOADING' });
        try {
            const base64 = await generateSpeech(text);
            if (!audioContextRef.current) audioContextRef.current = new AudioContext();
            const buffer = await decodeAudioData(decode(base64), audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => {
                setTtsState({ messageId: null, status: 'STOPPED' });
                stopCaptions();
            };
            source.start();
            ttsSourceNodeRef.current = source;
            setTtsState({ messageId: id, status: 'PLAYING' });
            startCaptions(text, buffer.duration);
        } catch (e: any) { 
            setTtsState({ messageId: null, status: 'STOPPED' }); 
            stopCaptions();
            setError(e.message);
        }
    };

    return (
        <div className="flex h-full relative overflow-hidden">
            {/* Overlay de Subtítulos Animados */}
            {ttsState.status === 'PLAYING' && visibleCaptions && (
                <div className="fixed bottom-32 md:bottom-40 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-6 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-5 rounded-[2rem] shadow-2xl animate-scaleIn text-center">
                        <p className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">
                            {visibleCaptions}
                            <span className={`inline-block ml-1 w-2 h-6 bg-red-600 animate-pulse align-middle`}></span>
                        </p>
                    </div>
                </div>
            )}

            <div className={`absolute md:relative z-20 bg-zinc-900/95 backdrop-blur-xl border-r border-white/5 w-72 h-full transition-transform duration-300 ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0'} flex flex-col shadow-2xl`}>
                 <div className="p-5 flex justify-between items-center border-b border-white/5">
                    <h3 className="font-bold text-zinc-300 tracking-tight">Historial 🧐🍷</h3>
                    <button onClick={() => setIsHistoryOpen(false)} className="md:hidden text-zinc-500 hover:text-white p-1"><XCircleIcon className="w-6 h-6"/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <button onClick={() => {
                        const n = createNewSession(activeSession?.mode);
                        setSessions([n, ...sessions]); setActiveSessionId(n.id); setIsHistoryOpen(false);
                    }} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${currentTheme.colors.secondary} ${currentTheme.colors.text} font-bold transition-all active:scale-95 shadow-lg`}>
                        <PlusIcon className="w-5 h-5" /> Nuevo Chat
                    </button>
                    {sessions.map(s => (
                        <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`p-4 rounded-2xl cursor-pointer flex justify-between items-center group transition-all ${activeSessionId === s.id ? `bg-zinc-800 text-white ring-1 ${currentTheme.colors.ring}` : 'text-zinc-500 hover:bg-white/5'}`}>
                            <span className="truncate text-sm font-medium">{s.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); setSessions(sessions.filter(x => x.id !== s.id)); }} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
                        </div>
                    ))}
                 </div>
            </div>

            <div className="flex-1 flex flex-col h-full w-full bg-transparent overflow-hidden">
                <div className="h-16 md:h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-black/10 backdrop-blur-xl z-10">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="p-2 text-zinc-400 hover:text-white transition-all active:scale-90"><MenuIcon className="w-6 h-6"/></button>
                        {Object.values(ChatMode).map(m => (
                            <button key={m} onClick={() => updateSession(activeSession!.id, { mode: m, messages: [], history: [] })} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold tracking-tight transition-all active:scale-95 border ${activeSession?.mode === m ? `${currentTheme.colors.accentBg} ${currentTheme.colors.text} ${currentTheme.colors.border}` : 'bg-transparent text-zinc-500 border-zinc-800'}`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 no-scrollbar">
                    {activeSession?.messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col animate-fadeIn ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[90%] md:max-w-[75%] p-4 md:p-6 rounded-[2rem] shadow-2xl border transition-all ${msg.sender === 'user' ? `${currentTheme.colors.userBubble} text-white rounded-tr-none border-transparent` : 'bg-zinc-900 border-white/5 text-zinc-100 rounded-tl-none'}`}>
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
                                        {msg.attachments.map((a, i) => (
                                            <div key={i} className="h-24 w-24 rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-zinc-800">
                                                {a.type.startsWith('image/') ? (
                                                    <img src={a.url} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center">
                                                        <FileIcon className="w-8 h-8 text-zinc-500" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="prose prose-invert prose-sm md:prose-base max-w-none leading-relaxed">
                                    {msg.text.split('\n').map((line, i) => <p key={i} className="min-h-[1rem]">{line}</p>)}
                                </div>
                                {msg.sender === 'ai' && (
                                    <div className="mt-4 flex items-center gap-4 pt-4 border-t border-white/5">
                                        <button onClick={() => handleTts(msg.id, msg.text)} className="text-zinc-500 hover:text-white active:scale-90 transition-all">
                                            {ttsState.messageId === msg.id && ttsState.status === 'LOADING' ? <LoadingSpinner /> : (ttsState.messageId === msg.id && ttsState.status === 'PLAYING' ? <PauseIcon className="w-5 h-5"/> : <SoundIcon className="w-5 h-5"/>)}
                                        </button>
                                        <button onClick={() => navigator.clipboard.writeText(msg.text)} className="text-zinc-500 hover:text-white transition-all active:scale-90"><CopyIcon className="w-5 h-5"/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && <div className="flex justify-start animate-fadeIn"><div className="bg-zinc-900 px-6 py-4 rounded-[2rem] rounded-tl-none border border-white/5 flex gap-2"><div className={`w-2.5 h-2.5 ${currentTheme.colors.primary} rounded-full animate-bounce`}></div><div className={`w-2.5 h-2.5 ${currentTheme.colors.primary} rounded-full animate-bounce delay-100`}></div><div className={`w-2.5 h-2.5 ${currentTheme.colors.primary} rounded-full animate-bounce delay-200`}></div></div></div>}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                <div className="p-3 md:p-6 bg-black/5 backdrop-blur-xl border-t border-white/5">
                    <div className={`max-w-4xl mx-auto bg-zinc-900/80 border rounded-[2rem] p-2 md:p-3 transition-all shadow-2xl flex flex-col gap-1 relative border-white/10`}>
                        <div className="flex gap-2 px-3 overflow-x-auto no-scrollbar items-center min-h-[24px]">
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => handleSend(s)} className="text-[10px] whitespace-nowrap px-3 py-1 rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all">{s}</button>
                            ))}
                        </div>
                        
                        {mediaPreviews.length > 0 && (
                            <div className="flex gap-3 px-3 py-3 overflow-x-auto no-scrollbar border-t border-white/5 mt-1 animate-fadeIn">
                                {mediaPreviews.map((p, i) => (
                                    <AttachmentPreview key={i} attachment={p} onRemove={() => { 
                                        setMediaPreviews(prev => prev.filter((_, idx) => idx !== i)); 
                                        setAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); 
                                    }} />
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-zinc-400 hover:text-white bg-white/5 rounded-full transition-all active:scale-90" title="Adjuntar archivos"><PaperclipIcon className="w-5 h-5"/></button>
                            <button onClick={toggleListening} className={`p-2.5 rounded-full transition-all ${isListening ? `${currentTheme.colors.text} ${currentTheme.colors.secondary} animate-pulse` : 'text-zinc-400 hover:text-white bg-white/5'}`} title="Dictar mensaje"><MicIcon className="w-5 h-5"/></button>
                            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

                            <input 
                                value={input} 
                                onChange={e => { setInput(e.target.value); if(error) setError(null); }}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                placeholder={isListening ? "Escuchando..." : (mediaPreviews.some(p => p.status === 'uploading') ? "Procesando archivos..." : "¿Qué quieres saber? 🧐🍷")}
                                className="flex-1 bg-transparent border-none text-white focus:outline-none px-2 py-3 text-sm md:text-base placeholder-zinc-600"
                                disabled={mediaPreviews.some(p => p.status === 'uploading')}
                            />

                            <button onClick={() => handleSend()} disabled={(!input.trim() && !attachedFiles.length) || mediaPreviews.some(p => p.status === 'uploading')} className={`p-3 md:p-4 text-white rounded-full transition-all shadow-xl active:scale-90 disabled:opacity-40 ${currentTheme.colors.sendButton}`}>
                                {isLoading ? <LoadingSpinner /> : <SendIcon className="w-5 h-5 md:w-6 md:h-6" />}
                            </button>
                        </div>
                    </div>
                    {/* Send Status Message */}
                    {error && (
                        <div className="max-w-4xl mx-auto mt-3 px-4 py-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs md:text-sm rounded-xl flex items-center justify-between animate-fadeIn">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🧐🍷</span>
                                <span>{error}</span>
                            </div>
                            <button onClick={() => setError(null)} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Chat;
