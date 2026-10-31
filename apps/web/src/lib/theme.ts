import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function initial(): Theme {
  try {
    const saved = localStorage.getItem("wv-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  // The approved design is light; dark mode is only used when someone chooses it in the app.
  return "light";
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(initial);
  useEffect(() => applyTheme(theme), [theme]);
  const setTheme = (t: Theme) => {
    try { localStorage.setItem("wv-theme", t); } catch { /* ignore */ }
    setThemeState(t);
  };
  return { theme, setTheme };
}
