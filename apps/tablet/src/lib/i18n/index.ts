import { addMessages, init } from 'svelte-i18n';
import { DEFAULT_LANGUAGE } from './config.js';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import id from '../locales/id.json';

let initialized = false;

// SSR renders translated text synchronously. Registering these dictionaries
// through lazy import() leaves the locale unset until its Promise resolves,
// which makes the first server render fail as soon as $_(...) is evaluated.
addMessages('en', en);
addMessages('zh', zh);
addMessages('id', id);

export function setupI18n() {
	if (initialized) return;
	init({
		fallbackLocale: DEFAULT_LANGUAGE,
		initialLocale: DEFAULT_LANGUAGE,
		warnOnMissingMessages: import.meta.env.DEV
	});
	initialized = true;
}

export { _, locale } from 'svelte-i18n';
export * from './config.js';
