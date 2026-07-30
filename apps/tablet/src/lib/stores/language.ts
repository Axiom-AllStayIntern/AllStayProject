import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { locale } from 'svelte-i18n';
import { Preferences } from '@capacitor/preferences';
import {
	DEFAULT_LANGUAGE,
	LANGUAGE_CONFIG,
	SUPPORTED_LANGUAGES,
	normalizeLanguage,
	type Language
} from '$lib/i18n/config.js';

export type { Language } from '$lib/i18n/config.js';

export type LocalizedText = Partial<Record<Language, string>> & { en: string };

const PREFERENCE_KEY = 'allstay.language';

/** Return the requested translation, falling back to English while UI copy is being translated. */
export function localize(value: LocalizedText, lang: Language): string {
	const candidates = [value[lang], value.en, value.zh, value.id];
	return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0) ?? '';
}

function createLanguageStore() {
	const { subscribe, set } = writable<Language>('en');
	let current: Language = DEFAULT_LANGUAGE;
	let initialized = false;

	function apply(lang: Language, persist: boolean) {
		current = lang;
		set(lang);
		locale.set(lang);

		if (!browser) return;
		document.documentElement.lang = LANGUAGE_CONFIG[lang].htmlLang;
		if (persist) {
			void Preferences.set({ key: PREFERENCE_KEY, value: lang }).catch(() => {
				localStorage.setItem(PREFERENCE_KEY, lang);
			});
		}
	}

	return {
		subscribe,
		set(lang: Language) {
			apply(lang, true);
		},
		async initialize() {
			if (!browser || initialized) return current;
			initialized = true;

			let saved: string | null = null;
			try {
				saved = (await Preferences.get({ key: PREFERENCE_KEY })).value;
			} catch {
				saved = localStorage.getItem(PREFERENCE_KEY);
			}

			const initial = normalizeLanguage(saved) ?? normalizeLanguage(navigator.language) ?? DEFAULT_LANGUAGE;
			apply(initial, false);
			return initial;
		},
		toggle() {
			const index = SUPPORTED_LANGUAGES.indexOf(current);
			apply(SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length], true);
		}
	};
}

export const language = createLanguageStore();
