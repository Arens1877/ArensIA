import React from 'react';
import { ChatSession } from '../types';
import { PlusIcon, TrashIcon } from './icons';

interface HistorySidebarProps {
    sessions: ChatSession[];
    activeSessionId: string | null;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ sessions, activeSessionId, onNewChat, onSelectChat, onDeleteChat }) => {

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent onSelectChat from firing
        if (window.confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
            onDeleteChat(id);
        }
    };

    return (
        <div className="w-64 bg-gray-800 flex-col h-full border-r border-gray-700 hidden md:flex">
            <div className="p-4 border-b border-gray-700">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition duration-200"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Nuevo Chat
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <nav className="p-2 space-y-1">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => onSelectChat(session.id)}
                            className={`group flex items-center justify-between w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer transition-colors duration-150 ${
                                activeSessionId === session.id
                                    ? 'bg-gray-700 text-white'
                                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                            }`}
                        >
                            <span className="truncate flex-1 pr-2">{session.title}</span>
                            <button
                                onClick={(e) => handleDelete(e, session.id)}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Eliminar chat"
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </nav>
            </div>
        </div>
    );
};

export default HistorySidebar;
