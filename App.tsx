

import React, { useState } from 'react';
import Header from './components/Header';
import Chat from './components/Chat';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import VisionAnalyzer from './components/VisionAnalyzer';
import LiveConversation from './components/LiveConversation';
import VideoGenerator from './components/VideoGenerator';
import { Tab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.CHAT:
        return <Chat />;
      case Tab.IMAGE_GEN:
        return <ImageGenerator />;
      case Tab.IMAGE_EDIT:
        return <ImageEditor />;
      case Tab.VIDEO_GEN:
        return <VideoGenerator />;
      case Tab.VISION:
        return <VisionAnalyzer />;
      case Tab.LIVE:
        return <LiveConversation />;
      default:
        return <Chat />;
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col font-sans">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;