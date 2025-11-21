
import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatMode, ChatSession, Attachment } from '../types';
import { generateChatResponse, generateSpeech } from '../services/geminiService';
import { LoadingSpinner, SendIcon, SoundIcon, PaperclipIcon, XCircleIcon, FileIcon, MicIcon, MenuIcon, CopyIcon, PauseIcon, TrashIcon, PlusIcon, LinkIcon, SparklesIcon, StarIcon } from './icons';
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
    const renderContent = () => {
        if (attachment.type.startsWith('image/')) return <img src={attachment.url} alt={attachment.name} className="w-full h-full object-cover rounded-xl" />;
        return <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 rounded-xl"><FileIcon className="w-6 h-6 text-zinc-400" /></div>;
    };
    return (
        <div className="relative w-16 h-16 group animate-scaleIn flex-shrink-0">
            {renderContent()}
            <button onClick={onRemove} className="absolute -top-2 -right-2 bg-zinc-900 border border-zinc-700 rounded-full p-0.5 text-zinc-400 hover:text-red-500 transition-colors shadow-lg active:scale-90 z-10">
                <XCircleIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

const getSmartSuggestions = (input: string): string[] => {
    const lower = input.toLowerCase();
    
    if (!input.trim()) {
        return [
            "Sorpréndeme con un dato elegante 🧐",
            "Genera una imagen surrealista 🎨",
            "Analiza las tendencias actuales 🍷"
        ];
    }

    if (lower.includes('imagen') || lower.includes('foto') || lower.includes('pintura')) {
        return [
            "Genera una imagen fotorrealista 4K",
            "Crea un paisaje cyberpunk neón",
            "Diseña un logotipo minimalista"
        ];
    }

    if (lower.includes('video') || lower.includes('película')) {
        return [
            "Crea un guion cinematográfico",
            "Genera un prompt para un video épico",
            "Explícame cómo hacer transiciones suaves"
        ];
    }

    if (lower.includes('código') || lower.includes('program') || lower.includes('react') || lower.includes('js')) {
        return [
            "Genera un componente de React moderno",
            "Optimiza este algoritmo con elegancia",
            "Explica este concepto de programación"
        ];
    }

    if (lower.includes('hola') || lower.includes('buenos') || lower.includes('saludo')) {
        return [
            "Saludos cordiales, Arens 🍷",
            "Hola, distinguida inteligencia",
            "¿Cómo te encuentras hoy?"
        ];
    }

    if (lower.includes('explica') || lower.includes('qué es') || lower.includes('resumen')) {
        return [
            "Explícame esto con detalle y sofisticación",
            "Dame un resumen ejecutivo breve",
            "Analiza los puntos clave"
        ];
    }
    
    return [];
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
    const [isListening, setIsListening] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [detectedLink, setDetectedLink] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    
    const { currentTheme } = useTheme();
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const ttsSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const saved = localStorage.getItem(CHAT_SESSIONS_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        if (parsed.length) {
            setSessions(parsed);
            setActiveSessionId(parsed[0].id);
        } else {
            const newS = createNewSession();
            setSessions([newS]);
            setActiveSessionId(newS.id);
        }
    }, []);

    useEffect(() => {
        if (sessions.length) localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }, [sessions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [sessions, activeSessionId, isLoading]);

    // URL detection & Suggestion logic
    useEffect(() => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = input.match(urlRegex);
        if (match && match.length > 0) {
            setDetectedLink(match[0]);
        } else {
            setDetectedLink(null);
        }

        setSuggestions(getSmartSuggestions(input));
    }, [input]);

    const activeSession = sessions.find(s => s.id === activeSessionId);

    const updateSession = (id: string, updates: Partial<ChatSession>) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const toggleFavorite = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSessions(prev => prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s));
    };

    const handleSend = async (textToSend?: string) => {
        const messageText = textToSend || input;
        if ((!messageText.trim() && !attachedFiles.length) || isLoading || !activeSession) return;
        
        const newMessage: Message = { id: crypto.randomUUID(), sender: 'user', text: messageText.trim(), attachments: mediaPreviews };
        const updatedMessages = [...activeSession.messages, newMessage];
        const isFirst = activeSession.messages.length <= 1;
        
        updateSession(activeSession.id, { messages: updatedMessages, title: isFirst ? (messageText.substring(0, 30) || "Media") : activeSession.title });
        setInput(''); setAttachedFiles([]); setMediaPreviews([]); setIsLoading(true); setError(null); setDetectedLink(null);

        try {
            const mediaParts: Part[] = [];
            for (const file of attachedFiles) {
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
            
            const aiMsg: Message = { 
                id: crypto.randomUUID(), 
                sender: 'ai', 
                text: res.text, 
                sources: res.sources, 
                mediaUrl: res.mediaUrl, 
                mediaType: res.mediaType,
                suggestions: res.suggestions
            };

            const userParts: Part[] = [{ text: newMessage.text }, ...mediaParts];
            updateSession(activeSession.id, {
                messages: [...updatedMessages, aiMsg],
                history: [...activeSession.history, { role: 'user', parts: userParts }, { role: 'model', parts: res.historyParts }]
            });
        } catch (e: any) {
            setError(e.message);
            updateSession(activeSession.id, { messages: [...updatedMessages, { id: crypto.randomUUID(), sender: 'ai', text: `Error: ${e.message}` }] });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        handleSend(suggestion);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            processFiles(files);
        }
    };

    const processFiles = (files: File[]) => {
        setAttachedFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(f => ({ name: f.name, type: f.type, url: URL.createObjectURL(f) }));
        setMediaPreviews(prev => [...prev, ...newPreviews]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Tu navegador no soporta la transcripción de voz.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        
        recognition.onresult = (event: any) => {
             const transcript = event.results[0][0].transcript;
             setInput(prev => (prev ? prev + ' ' : '') + transcript);
        };
        
        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const handleTts = async (id: string, text: string) => {
        if (ttsState.status === 'PLAYING' && ttsSourceNodeRef.current) {
            ttsSourceNodeRef.current.stop();
            setTtsState({ messageId: null, status: 'STOPPED' });
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
            source.onended = () => setTtsState({ messageId: null, status: 'STOPPED' });
            source.start();
            ttsSourceNodeRef.current = source;
            setTtsState({ messageId: id, status: 'PLAYING' });
        } catch (e) { console.error(e); setTtsState({ messageId: null, status: 'STOPPED' }); }
    };

    const renderMessageText = (text: string) => {
        const codeBlockRegex = /```html\n([\s\S]*?)\n```/;
        const match = activeSession?.mode === ChatMode.CANVAS ? text.match(codeBlockRegex) : null;
        if (match) {
            return <><p className="whitespace-pre-wrap mb-4">{text.replace(match[0], '')}</p><CanvasRenderer code={match[1]} /></>;
        }
        return text.split('\n').map((line, i) => <p key={i} className="min-h-[1rem]">{line}</p>);
    };

    // Sort sessions: Favorites first, then by date (assuming implicit order is date)
    const sortedSessions = [...sessions].sort((a, b) => {
        if (a.isFavorite === b.isFavorite) return 0;
        return a.isFavorite ? -1 : 1;
    });

    return (
        <div className="flex h-full relative">
            {/* History Sidebar / Drawer */}
            <div className={`absolute md:relative z-20 bg-zinc-900/90 backdrop-blur border-r border-white/5 w-72 h-full transition-transform duration-300 ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden'} flex flex-col`}>
                 <div className="p-4 flex justify-between items-center border-b border-white/5">
                    <h3 className="font-semibold text-zinc-300">Historial</h3>
                    <button onClick={() => setIsHistoryOpen(false)} className="md:hidden text-zinc-400 hover:text-white active:scale-90 transition-transform"><XCircleIcon className="w-6 h-6"/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2">
                    <button onClick={() => {
                        const n = createNewSession(activeSession?.mode);
                        setSessions([n, ...sessions]);
                        setActiveSessionId(n.id);
                        setIsHistoryOpen(false);
                    }} className={`w-full flex items-center gap-2 p-3 rounded-xl ${currentTheme.colors.secondary} ${currentTheme.colors.text} mb-2 hover:opacity-80 active:scale-95 transition-all`}>
                        <PlusIcon className="w-5 h-5" /> Nuevo Chat
                    </button>
                    {sortedSessions.map(s => (
                        <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`p-3 rounded-xl cursor-pointer mb-1 flex justify-between items-center group transition-all duration-200 ${activeSessionId === s.id ? `bg-zinc-800 text-white border-l-2 ${currentTheme.colors.border}` : 'text-zinc-400 hover:bg-zinc-800/50'}`}>
                            <div className="flex items-center gap-2 overflow-hidden">
                                {s.isFavorite && <StarIcon className="w-3 h-3 text-yellow-500 flex-shrink-0" filled />}
                                <span className="truncate text-sm">{s.title}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => toggleFavorite(e, s.id)} className={`hover:text-yellow-500 transition-colors active:scale-90 ${s.isFavorite ? 'text-yellow-500 opacity-100' : 'text-zinc-500'}`}>
                                    <StarIcon className="w-4 h-4" filled={s.isFavorite} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setSessions(sessions.filter(x => x.id !== s.id)); }} className={`text-zinc-500 hover:${currentTheme.colors.text} transition-all active:scale-90`}><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full w-full bg-transparent">
                {/* Top Bar */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 bg-black/20 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="md:hidden p-2 text-zinc-400 active:scale-90 transition-transform"><MenuIcon className="w-6 h-6"/></button>
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="hidden md:block p-2 text-zinc-400 hover:text-white active:scale-90 transition-transform"><MenuIcon className="w-5 h-5"/></button>
                        <div className="h-6 w-px bg-zinc-800 mx-2"></div>
                        {Object.values(ChatMode).map(m => (
                            <button key={m} onClick={() => updateSession(activeSession!.id, { mode: m, messages: [], history: [] })} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${activeSession?.mode === m ? `${currentTheme.colors.accentBg} ${currentTheme.colors.text} ${currentTheme.colors.border}` : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {activeSession?.messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col animate-fadeIn ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl ${msg.sender === 'user' ? `${currentTheme.colors.userBubble} text-white rounded-tr-none` : 'bg-zinc-900 border border-white/10 text-zinc-100 rounded-tl-none'}`}>
                                {msg.mediaUrl && <img src={msg.mediaUrl} className="mb-3 rounded-lg max-h-64 w-full object-cover animate-scaleIn" />}
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                        {msg.attachments.map((a, i) => (
                                            <img key={i} src={a.url} className="h-20 w-20 rounded-lg object-cover border border-white/10 animate-scaleIn" style={{animationDelay: `${i * 50}ms`}} />
                                        ))}
                                    </div>
                                )}
                                <div className="prose prose-invert prose-sm max-w-none">
                                    {renderMessageText(msg.text)}
                                </div>
                                {msg.sender === 'ai' && (
                                    <div className="mt-3 flex items-center gap-3 pt-2 border-t border-white/5">
                                        <button onClick={() => handleTts(msg.id, msg.text)} className="text-zinc-500 hover:text-white transition-all active:scale-90">
                                            {ttsState.messageId === msg.id && ttsState.status === 'LOADING' ? <LoadingSpinner /> : (ttsState.messageId === msg.id && ttsState.status === 'PLAYING' ? <PauseIcon className="w-4 h-4"/> : <SoundIcon className="w-4 h-4"/>)}
                                        </button>
                                        <button onClick={() => navigator.clipboard.writeText(msg.text)} className="text-zinc-500 hover:text-white transition-all active:scale-90"><CopyIcon className="w-4 h-4"/></button>
                                    </div>
                                )}
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {msg.sources.map((s, i) => (
                                            <a key={i} href={s.uri} target="_blank" className={`text-xs bg-black/30 px-2 py-1 rounded hover:bg-black/50 ${currentTheme.colors.text.replace('text-', 'text-').replace('500', '300')} truncate max-w-[200px] block transition-colors active:scale-95`}>{s.title}</a>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Related Suggestions Below AI Response */}
                            {msg.sender === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2 max-w-[85%] md:max-w-[70%] justify-start animate-fadeIn delay-300">
                                    {msg.suggestions.map((s, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => handleSend(s)}
                                            className={`text-xs px-3 py-1.5 rounded-full border bg-black/20 hover:bg-white/10 transition-all active:scale-95 text-zinc-400 hover:text-white ${currentTheme.colors.border.replace('border-', 'hover:border-')} border-white/10`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && <div className="flex justify-start animate-fadeIn"><div className={`bg-zinc-900 p-4 rounded-2xl rounded-tl-none border border-white/10 flex gap-2`}><div className={`w-2 h-2 ${currentTheme.colors.primary.replace('bg-', 'bg-')} rounded-full animate-bounce`}></div><div className={`w-2 h-2 ${currentTheme.colors.primary.replace('bg-', 'bg-')} rounded-full animate-bounce delay-75`}></div><div className={`w-2 h-2 ${currentTheme.colors.primary.replace('bg-', 'bg-')} rounded-full animate-bounce delay-150`}></div></div></div>}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area - Unified Container */}
                <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm">
                    <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={handleDrop}
                        className={`max-w-4xl mx-auto bg-zinc-900 border rounded-[24px] p-2 transition-all shadow-lg flex flex-col gap-2 relative ${
                            isDragging 
                                ? `${currentTheme.colors.border} ring-2 ${currentTheme.colors.ring} bg-zinc-800` 
                                : `border-zinc-800 focus-within:ring-2 focus-within:${currentTheme.colors.ring} focus-within:border-transparent`
                        }`}
                    >
                         {isDragging && (
                            <div className={`absolute inset-0 rounded-[24px] ${currentTheme.colors.accentBg} flex items-center justify-center z-20 backdrop-blur-sm pointer-events-none animate-fadeIn`}>
                                <div className="bg-black/80 px-6 py-3 rounded-full text-white font-medium flex items-center gap-3 border border-white/10 shadow-xl">
                                     <PaperclipIcon className={`w-6 h-6 ${currentTheme.colors.text}`} /> 
                                     <span className="text-sm">Soltar para adjuntar archivos</span>
                                </div>
                            </div>
                        )}

                        {/* Intelligent Suggestions (Above Input) */}
                        <div className="flex gap-2 px-3 pt-1 overflow-x-auto no-scrollbar animate-fadeIn items-center h-8">
                            <SparklesIcon className={`w-4 h-4 flex-shrink-0 ${currentTheme.colors.text} opacity-70`} />
                            {suggestions.map((s, i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleSuggestionClick(s)}
                                    className={`text-xs whitespace-nowrap px-3 py-1 rounded-full bg-black/40 border border-white/5 hover:bg-white/10 ${currentTheme.colors.hover.replace('bg-', 'text-')} transition-all active:scale-95 text-zinc-400`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* Detected Link Indicator */}
                        {detectedLink && (
                            <div className="px-3 pt-1 animate-fadeIn">
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs ${currentTheme.colors.text}`}>
                                    <LinkIcon className="w-3 h-3" />
                                    <span className="font-medium truncate max-w-[200px]">🔗 Enlace detectado: Análisis activado</span>
                                </div>
                            </div>
                        )}
                        
                        {/* Media Previews Inside Input Area */}
                        {mediaPreviews.length > 0 && (
                            <div className="flex gap-2 px-2 pt-2 overflow-x-auto no-scrollbar animate-fadeIn">
                                {mediaPreviews.map((p, i) => (
                                    <AttachmentPreview 
                                        key={i} 
                                        attachment={p} 
                                        onRemove={() => { 
                                            setMediaPreviews(prev => prev.filter((_, idx) => idx !== i)); 
                                            setAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); 
                                        }} 
                                    />
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all active:scale-90" title="Adjuntar">
                                <PaperclipIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={toggleListening} className={`p-2 rounded-full transition-all active:scale-90 ${isListening ? `${currentTheme.colors.text} ${currentTheme.colors.secondary} animate-pulse` : 'text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700'}`} title="Dictar">
                                <MicIcon className="w-5 h-5"/>
                            </button>
                            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

                            <input 
                                value={input} 
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder={isListening ? "Escuchando..." : `Enviar mensaje a Arens IA (${activeSession?.mode})...`}
                                className="flex-1 bg-transparent border-none text-white focus:outline-none focus:ring-0 px-2 py-2 placeholder-zinc-500"
                            />

                            <button onClick={() => handleSend()} disabled={!input && !attachedFiles.length} className={`p-2 text-white rounded-full disabled:bg-zinc-700 disabled:text-zinc-500 transition-all shadow-lg active:scale-90 ${currentTheme.colors.sendButton}`}>
                                {isLoading ? <LoadingSpinner /> : <SendIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;
