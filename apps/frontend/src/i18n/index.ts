/**
 * i18n – Add new languages by creating src/i18n/locales/{lng}.json
 * Supported: en, az, ru (extend SUPPORTED_LANGS to add more)
 */

export const SUPPORTED_LANGS = ["en", "az", "ru"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const LANG_LABELS: Record<SupportedLang, string> = {
  en: "English",
  az: "Azərbaycan",
  ru: "Русский",
};

const localeCache: Record<string, Record<string, unknown>> = {};

const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*.json",
);

export async function loadLocale(
  lng: string,
): Promise<Record<string, unknown>> {
  if (localeCache[lng]) return localeCache[lng];
  const load = localeModules[`./locales/${lng}.json`];
  if (!load) return {};
  const mod = await load();
  localeCache[lng] = mod.default;
  return mod.default;
}

export function getNested(
  obj: Record<string, unknown>,
  path: string,
): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}
