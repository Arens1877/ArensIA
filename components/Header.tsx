
import React from 'react';
import { Tab } from '../types';
import { ChatIcon, EditIcon, ImageIcon, MicIcon, VisionIcon, VideoIcon, YouTubeIcon } from './icons';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { currentTheme } = useTheme();

  const tabs = [
    { id: Tab.CHAT, icon: <ChatIcon className="h-5 w-5 mr-2" /> },
    { id: Tab.IMAGE_GEN, icon: <ImageIcon className="h-5 w-5 mr-2" /> },
    { id: Tab.IMAGE_EDIT, icon: <EditIcon className="h-5 w-5 mr-2" /> },
    { id: Tab.VIDEO_GEN, icon: <VideoIcon className="h-5 w-5 mr-2" /> },
    { id: Tab.VISION, icon: <VisionIcon className="h-5 w-5 mr-2" /> },
    { id: Tab.LIVE, icon: <MicIcon className="h-5 w-5 mr-2" /> },
  ];

  return (
    <header className="bg-zinc-900/80 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-10 shadow-lg">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tighter">
          Arens <span className={currentTheme.colors.text}>IA</span>
        </h1>
        <nav className="flex flex-wrap justify-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95 ${
                activeTab === tab.id
                  ? `${currentTheme.colors.primary} text-white shadow-lg`
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent hover:border-white/10'
              }`}
            >
              {tab.icon}
              <span className="hidden lg:inline">{tab.id}</span>
            </button>
          ))}
          <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block"></div>
          <a
            href="https://youtube.com/@arens1877"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Canal de YouTube del creador"
            className="flex items-center px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/20 active:scale-95"
          >
            <YouTubeIcon className="h-5 w-5 mr-2" />
            <span className="hidden lg:inline">YouTube</span>
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
