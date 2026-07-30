export const SUPPORTED_LANGUAGES = ['en', 'zh', 'id'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export const LANGUAGE_CONFIG: Record<Language, {
	label: string;
	htmlLang: string;
	intlLocale: string;
	speechLocale: string;
}> = {
	en: { label: 'English', htmlLang: 'en', intlLocale: 'en-GB', speechLocale: 'en-US' },
	zh: { label: '中文', htmlLang: 'zh-CN', intlLocale: 'zh-CN', speechLocale: 'zh-CN' },
	id: { label: 'Bahasa Indonesia', htmlLang: 'id', intlLocale: 'id-ID', speechLocale: 'id-ID' }
};

export function normalizeLanguage(value: string | null | undefined): Language | null {
	if (!value) return null;
	const base = value.toLowerCase().split(/[-_]/)[0];
	if (base === 'zh') return 'zh';
	if (base === 'id' || base === 'in') return 'id';
	if (base === 'en') return 'en';
	return null;
}

export function intlLocale(language: Language): string {
	return LANGUAGE_CONFIG[language].intlLocale;
}
