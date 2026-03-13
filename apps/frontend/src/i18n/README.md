# Adding a new language

1. Create `src/i18n/locales/{lng}.json` (e.g. `fr.json`)
2. Copy the structure from `en.json` and translate the values
3. Add the language to `SUPPORTED_LANGS` and `LANG_LABELS` in `src/i18n/index.ts`

Example for French:

- Create `locales/fr.json`
- In `index.ts`: add `'fr'` to `SUPPORTED_LANGS` and `fr: 'Français'` to `LANG_LABELS`
