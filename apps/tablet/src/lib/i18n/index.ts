import { register, init } from 'svelte-i18n';
import { DEFAULT_LANGUAGE } from './config.js';

let initialized = false;

register('en', () => import('../locales/en.json'));
register('zh', () => import('../locales/zh.json'));
register('id', () => import('../locales/id.json'));

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
