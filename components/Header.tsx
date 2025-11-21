
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
    <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-2xl font-bold text-white mb-4 sm:mb-0">
          Arens <span className={currentTheme.colors.text}>IA</span>
        </h1>
        <nav className="flex flex-wrap justify-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeTab === tab.id
                  ? `${currentTheme.colors.primary} text-white`
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {tab.icon}
              <span className="hidden md:inline">{tab.id}</span>
            </button>
          ))}
          <a
            href="https://youtube.com/@arens1877"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Canal de YouTube del creador"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <YouTubeIcon className="h-5 w-5 mr-2" />
            <span className="hidden md:inline">Canal de YouTube</span>
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
