
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    hover: string;
    text: string;
    border: string;
    ring: string;
    gradient: string;
    accentBg: string;
    secondary: string;
    userBubble: string;
    sendButton: string;
  };
}

export const themes: Theme[] = [
  {
    id: 'crimson',
    name: 'Arens Clásico',
    colors: {
      primary: 'bg-red-600',
      hover: 'hover:bg-red-700',
      text: 'text-red-500',
      border: 'border-red-600',
      ring: 'ring-red-600',
      gradient: 'from-black to-zinc-900',
      accentBg: 'bg-red-600/10',
      secondary: 'bg-red-900/20',
      userBubble: 'bg-gradient-to-br from-red-600 to-red-700',
      sendButton: 'bg-red-600 hover:bg-red-500 shadow-red-900/20',
    },
  },
  {
    id: 'ocean',
    name: 'Océano Profundo',
    colors: {
      primary: 'bg-blue-600',
      hover: 'hover:bg-blue-700',
      text: 'text-blue-500',
      border: 'border-blue-600',
      ring: 'ring-blue-600',
      gradient: 'from-slate-950 to-black',
      accentBg: 'bg-blue-600/10',
      secondary: 'bg-blue-900/20',
      userBubble: 'bg-gradient-to-br from-blue-600 to-blue-700',
      sendButton: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20',
    },
  },
  {
    id: 'emerald',
    name: 'Esmeralda Digital',
    colors: {
      primary: 'bg-emerald-600',
      hover: 'hover:bg-emerald-700',
      text: 'text-emerald-500',
      border: 'border-emerald-600',
      ring: 'ring-emerald-600',
      gradient: 'from-green-950 to-black',
      accentBg: 'bg-emerald-600/10',
      secondary: 'bg-emerald-900/20',
      userBubble: 'bg-gradient-to-br from-emerald-600 to-emerald-700',
      sendButton: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20',
    },
  },
  {
    id: 'amethyst',
    name: 'Amatista Mística',
    colors: {
      primary: 'bg-purple-600',
      hover: 'hover:bg-purple-700',
      text: 'text-purple-500',
      border: 'border-purple-600',
      ring: 'ring-purple-600',
      gradient: 'from-purple-950 to-black',
      accentBg: 'bg-purple-600/10',
      secondary: 'bg-purple-900/20',
      userBubble: 'bg-gradient-to-br from-purple-600 to-purple-700',
      sendButton: 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20',
    },
  },
  {
    id: 'amber',
    name: 'Ámbar Solar',
    colors: {
      primary: 'bg-orange-600',
      hover: 'hover:bg-orange-700',
      text: 'text-orange-500',
      border: 'border-orange-600',
      ring: 'ring-orange-600',
      gradient: 'from-orange-950/30 to-black',
      accentBg: 'bg-orange-600/10',
      secondary: 'bg-orange-900/20',
      userBubble: 'bg-gradient-to-br from-orange-600 to-orange-700',
      sendButton: 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20',
    },
  },
];

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);

  useEffect(() => {
    const savedThemeId = localStorage.getItem('arens_ia_theme');
    if (savedThemeId) {
      const found = themes.find(t => t.id === savedThemeId);
      if (found) setCurrentTheme(found);
    }
  }, []);

  const handleSetTheme = (id: string) => {
    const found = themes.find(t => t.id === id);
    if (found) {
      setCurrentTheme(found);
      localStorage.setItem('arens_ia_theme', id);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
