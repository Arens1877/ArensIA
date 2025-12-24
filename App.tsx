
import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import VisionAnalyzer from './components/VisionAnalyzer';
import LiveConversation from './components/LiveConversation';
import VideoGenerator from './components/VideoGenerator';
import YouTubeSearch from './components/YouTubeSearch';
import Tutorial from './components/Tutorial';
import ThemeSelector from './components/ThemeSelector';
import { Tab } from './types';
import { ChatIcon, ImageIcon, EditIcon, VideoIcon, VisionIcon, MicIcon, YouTubeIcon, PaletteIcon } from './components/icons';
import { useTheme } from './contexts/ThemeContext';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  const { currentTheme } = useTheme();

  useEffect(() => {
    const tutorialSeen = localStorage.getItem('arens_ia_tutorial_seen');
    if (!tutorialSeen) {
        setShowTutorial(true);
    }
  }, []);

  const handleCloseTutorial = () => {
    localStorage.setItem('arens_ia_tutorial_seen', 'true');
    setShowTutorial(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.CHAT: return <Chat />;
      case Tab.IMAGE_GEN: return <ImageGenerator />;
      case Tab.IMAGE_EDIT: return <ImageEditor />;
      case Tab.VIDEO_GEN: return <VideoGenerator />;
      case Tab.VISION: return <VisionAnalyzer />;
      case Tab.LIVE: return <LiveConversation />;
      case Tab.YOUTUBE: return <YouTubeSearch />;
      default: return <Chat />;
    }
  };

  const tabs = [
    { id: Tab.CHAT, icon: ChatIcon, label: 'Chat' },
    { id: Tab.IMAGE_GEN, icon: ImageIcon, label: 'Crear Imagen' },
    { id: Tab.IMAGE_EDIT, icon: EditIcon, label: 'Editar Imagen' },
    { id: Tab.VIDEO_GEN, icon: VideoIcon, label: 'Crear Video' },
    { id: Tab.VISION, icon: VisionIcon, label: 'Visión' },
    { id: Tab.LIVE, icon: MicIcon, label: 'Live' },
    { id: Tab.YOUTUBE, icon: YouTubeIcon, label: 'YouTube Explorer' },
  ];

  return (
    <div className={`flex h-screen supports-[height:100dvh]:h-[100dvh] bg-gradient-to-b ${currentTheme.colors.gradient} text-white overflow-hidden transition-colors duration-500`}>
      {showTutorial && <Tutorial onClose={handleCloseTutorial} />}
      <ThemeSelector isOpen={showThemeSelector} onClose={() => setShowThemeSelector(false)} />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-zinc-900/50 border-r border-white/5 backdrop-blur-xl z-20">
        <div className="p-8 flex items-center gap-3">
          <div className={`w-10 h-10 bg-gradient-to-br ${currentTheme.colors.userBubble} rounded-xl flex items-center justify-center shadow-lg transition-all duration-300`}>
             <span className="font-bold text-xl">A</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tighter">Arens <span className={`${currentTheme.colors.text} transition-colors duration-300`}>IA</span></h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group active:scale-95 ${
                activeTab === tab.id
                  ? `${currentTheme.colors.accentBg} ${currentTheme.colors.text} border ${currentTheme.colors.secondary}`
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <tab.icon className={`w-5 h-5 mr-3 transition-transform group-hover:scale-110 ${activeTab === tab.id ? currentTheme.colors.text : 'text-zinc-500 group-hover:text-white'}`} />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
             <button
                onClick={() => setShowThemeSelector(true)}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-zinc-400 rounded-xl hover:bg-white/5 hover:text-white transition-all active:scale-95 group"
             >
                <PaletteIcon className={`w-5 h-5 mr-3 ${currentTheme.colors.text} group-hover:scale-110 transition-transform`} />
                Tema
             </button>

             <a
                href="https://youtube.com/@arens1877"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-3 text-sm font-bold text-zinc-300 rounded-xl bg-red-600/10 border border-red-600/20 hover:bg-red-600 hover:text-white transition-all active:scale-95 group"
            >
                <YouTubeIcon className={`w-5 h-5 mr-3 text-red-500 group-hover:text-white group-hover:scale-110 transition-all`} />
                Canal del Creador
            </a>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-4">
         <div className="flex items-center gap-2">
             <div className={`w-8 h-8 bg-gradient-to-br ${currentTheme.colors.userBubble} rounded-lg flex items-center justify-center`}>
                <span className="font-bold text-white">A</span>
             </div>
             <h1 className="text-lg font-bold">Arens <span className={currentTheme.colors.text}>IA</span></h1>
         </div>
         <div className="flex items-center gap-2">
             <button onClick={() => setShowThemeSelector(true)} className="p-2 text-zinc-300 hover:text-white">
                <PaletteIcon className="w-6 h-6" />
             </button>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-300 hover:text-white active:scale-90 transition-transform">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
             </button>
         </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/95 z-40 pt-20 px-6 animate-fadeIn overflow-y-auto pb-10">
            <div className="grid grid-cols-2 gap-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                        className={`flex flex-col items-center p-4 rounded-2xl border transition-all active:scale-95 ${
                             activeTab === tab.id ? `${currentTheme.colors.secondary} ${currentTheme.colors.border} ${currentTheme.colors.text}` : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                    >
                        <tab.icon className="w-8 h-8 mb-2" />
                        <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                ))}
                <a
                    href="https://youtube.com/@arens1877"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 flex items-center justify-center p-4 rounded-2xl border border-red-600/30 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-all active:scale-95 mt-2"
                >
                    <YouTubeIcon className={`w-6 h-6 mr-3`} />
                    <span className="font-bold">Canal del Creador</span>
                </a>
            </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 relative w-full max-w-full md:pt-0 pt-16 bg-gradient-to-b ${currentTheme.colors.gradient}`}>
          <div className="h-full overflow-hidden relative">
              <div key={activeTab} className="h-full animate-fadeIn">
                {renderContent()}
              </div>
          </div>
      </main>
    </div>
  );
};

export default App;
