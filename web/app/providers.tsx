"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";

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
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const savedTheme = window.localStorage.getItem("anime-ai-theme");
    return savedTheme === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem("anime-ai-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <SessionProvider>{children}</SessionProvider>
    </ThemeContext.Provider>
  );
}
