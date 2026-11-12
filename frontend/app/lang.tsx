"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DICTS, Lang } from "./i18n";

export const LANG_STORAGE_KEY = "fieldshift.lang";

type LangContextValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  toggle: () => void;
  t: (typeof DICTS)[Lang];
  num: (value: number | string, digits?: number) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

function readStoredLang(): string | null {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLang(value: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode etc.): the in-memory choice still applies.
  }
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Always start at "en" so the first client render matches the server render;
  // detection/persistence is applied in an effect, avoiding hydration mismatch.
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const stored = readStoredLang();
    const detected: Lang = (navigator.language || "").toLowerCase().startsWith("ar") ? "ar" : "en";
    const next: Lang = stored === "ar" || stored === "en" ? stored : detected;
    if (stored !== next) storeLang(next);
    // Hydration-safe restore: the first render must stay "en" to match the server,
    // so the stored/detected language is applied once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang((current) => (current === next ? current : next));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = DICTS[lang].meta.title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", DICTS[lang].meta.description);
  }, [lang]);

  const toggle = useCallback(() => {
    setLang((current) => {
      const next = current === "en" ? "ar" : "en";
      storeLang(next);
      return next;
    });
  }, []);
  const value = useMemo<LangContextValue>(() => ({
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    toggle,
    t: DICTS[lang],
    // Western digits in both languages for scientific values; Arabic uses Intl
    // grouping without Arabic-Indic digits (ar-u-nu-latn). English keeps the
    // exact legacy rendering so results do not shift.
    num: (v: number | string, digits?: number) => (lang === "ar"
      ? new Intl.NumberFormat("ar-u-nu-latn", digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v))
      : String(v)),
  }), [lang, toggle]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang must be used inside LangProvider");
  return context;
}

export function Ltr({ children }: { children: React.ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}
