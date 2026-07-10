/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getNested, loadLocale, type SupportedLang } from "@/i18n";

type I18nContextValue = {
  lang: SupportedLang;
  setLang: (lng: SupportedLang) => void;
  t: (key: string) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "loomy-lang";
const DEFAULT_LANG: SupportedLang = "en";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SupportedLang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SupportedLang | null;
      if (stored && ["en", "az", "ru"].includes(stored)) return stored;
    } catch {
      // localStorage might be unavailable (SSR/private mode); ignore and fall back to default.
    }
    return DEFAULT_LANG;
  });
  const [messages, setMessages] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLocale(lang).then((msgs) => {
      // Discard a stale response: if `lang` changed again before this
      // resolved, a newer effect run already owns `messages`.
      if (cancelled) return;
      setMessages(msgs);
      setReady(true);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // Ignore storage errors; i18n still works without persistence.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((lng: SupportedLang) => {
    setLangState(lng);
  }, []);

  const t = useCallback(
    (key: string) => {
      const value = getNested(messages as Record<string, unknown>, key);
      return value ?? key;
    },
    [messages],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, ready }),
    [lang, setLang, t, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
