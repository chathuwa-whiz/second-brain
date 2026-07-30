"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
type Preference = Theme | "system";

const STORAGE_KEY = "second-brain-theme";

const ThemeContext = createContext<{
  preference: Preference;
  resolved: Theme;
  setPreference: (p: Preference) => void;
}>({ preference: "system", resolved: "dark", setPreference: () => {} });

export const useTheme = () => useContext(ThemeContext);

function systemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<Preference>("system");
  const [resolved, setResolved] = useState<Theme>("dark");

  // Read the saved preference after mount. The inline script in layout.tsx has
  // already applied the right theme to <html> by this point, so there's no
  // flash - this just syncs React state to what the DOM already shows.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Preference | null;
    const pref: Preference =
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "system";
    setPreferenceState(pref);
    setResolved(pref === "system" ? systemTheme() : pref);
  }, []);

  // Follow the OS live, but only while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolved(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  function setPreference(p: Preference) {
    setPreferenceState(p);
    setResolved(p === "system" ? systemTheme() : p);
    window.localStorage.setItem(STORAGE_KEY, p);
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/*
  Runs before first paint, so the correct theme is on <html> before any pixels
  render. Without this the page flashes dark-then-light (or the reverse) on
  every hard navigation, which is the single most noticeable theming bug.
*/
export const themeBootstrapScript = `
(function () {
  try {
    var saved = localStorage.getItem('${STORAGE_KEY}');
    var theme = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;
