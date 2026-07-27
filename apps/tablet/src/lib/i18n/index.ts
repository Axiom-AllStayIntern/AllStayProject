import { register, init, getLocaleFromNavigator } from 'svelte-i18n';

register('en', () => import('../locales/en.json'));
register('zh', () => import('../locales/zh.json'));

export function setupI18n() {
	init({
		fallbackLocale: 'en',
		initialLocale: getLocaleFromNavigator() ?? 'en'
	});
}
