import { writable } from 'svelte/store';
import { locale } from 'svelte-i18n';

export type Language = 'en' | 'zh' | 'id';

function createLanguageStore() {
	const { subscribe, set } = writable<Language>('en');

	return {
		subscribe,
		set(lang: Language) {
			set(lang);
			// The AI/voice language can be 'id', but the UI dictionary is only en/zh
			// for now — fall the UI locale back to English until an 'id' dictionary exists.
			locale.set(lang === 'id' ? 'en' : lang);
			// TODO: persist to Capacitor Preferences; add 'id' UI dictionary
		},
		toggle() {
			this.subscribe((current) => {
				this.set(current === 'en' ? 'zh' : 'en');
			})();
		}
	};
}

export const language = createLanguageStore();
