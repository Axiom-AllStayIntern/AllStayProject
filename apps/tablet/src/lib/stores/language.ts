import { writable } from 'svelte/store';
import { locale } from 'svelte-i18n';

export type Language = 'en' | 'zh';

function createLanguageStore() {
	const { subscribe, set } = writable<Language>('en');

	return {
		subscribe,
		set(lang: Language) {
			set(lang);
			locale.set(lang);
			// TODO: persist to Capacitor Preferences
		},
		toggle() {
			this.subscribe((current) => {
				this.set(current === 'en' ? 'zh' : 'en');
			})();
		}
	};
}

export const language = createLanguageStore();
