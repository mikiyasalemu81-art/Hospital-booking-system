'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Read persisted preference on mount and apply immediately
  useEffect(() => {
    let resolved: Theme = 'light';
    try {
      const stored = localStorage.getItem('clinic-theme') as Theme | null;
      if (stored === 'dark' || stored === 'light') {
        resolved = stored;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        resolved = 'dark';
      }
    } catch {
      // localStorage may fail in restricted iframe / private browsing
    }

    setTheme(resolved);
    const root = document.documentElement;
    const body = document.body;
    if (resolved === 'dark') {
      root.classList.add('dark');
      body?.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body?.classList.remove('dark');
    }
    setMounted(true);
  }, []);

  // Apply / remove "dark" class on <html> and <body> whenever theme changes
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      body?.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body?.classList.remove('dark');
    }
    try {
      localStorage.setItem('clinic-theme', theme);
    } catch {
      // ignore
    }
  }, [theme, mounted]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
