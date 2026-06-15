import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = 'dark' | 'light';

export const darkColors = {
  bg: '#050505',
  card: '#0d0d0f',
  cardSecondary: '#16161a',
  border: '#222',
  text: '#FFF',
  textSecondary: '#64748b',
  textMuted: '#475569',
  primary: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#facc15',
  accentBg: 'rgba(59, 130, 246, 0.1)',
  accentBorder: 'rgba(59, 130, 246, 0.2)',
  inputBg: '#111',
  tabBarBg: '#080808',
  backdrop: 'rgba(0, 0, 0, 0.75)',
};

export const lightColors = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardSecondary: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#facc15',
  accentBg: 'rgba(59, 130, 246, 0.05)',
  accentBorder: 'rgba(59, 130, 246, 0.15)',
  inputBg: '#f1f5f9',
  tabBarBg: '#ffffff',
  backdrop: 'rgba(15, 23, 42, 0.3)',
};

export type ThemeColors = typeof darkColors;

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('dark');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem('theme_preference');
        if (saved === 'light') {
          setTheme('light');
        }
      } catch (e) {
        console.error('Error loading theme:', e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      await AsyncStorage.setItem('theme_preference', next);
    } catch (e) {
      console.error('Error saving theme:', e);
    }
  };

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark: theme === 'dark', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
