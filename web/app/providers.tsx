"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";
import BannedSessionGate from "./_components/BannedSessionGate";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside Providers");
  return context;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // New visitors start in dark mode. A returning visitor keeps their saved choice.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("anime-ai-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      const frame = window.requestAnimationFrame(() => setTheme(savedTheme));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem("anime-ai-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <SessionProvider refetchInterval={30} refetchOnWindowFocus>
        <BannedSessionGate />
        {children}
      </SessionProvider>
    </ThemeContext.Provider>
  );
}
