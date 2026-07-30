import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localeDir = join(root, 'src', 'lib', 'locales');
const languages = ['en', 'zh', 'id'];

function flatten(value, prefix = '', result = new Map()) {
	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof child === 'string') result.set(path, child);
		else if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, result);
		else throw new Error(`Invalid translation value at ${path}`);
	}
	return result;
}

function placeholders(message) {
	return [...message.matchAll(/\{([A-Za-z][\w]*)\}/g)].map((match) => match[1]).sort();
}

async function sourceFiles(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...await sourceFiles(path));
		else if (['.svelte', '.ts'].includes(extname(entry.name))) files.push(path);
	}
	return files;
}

const dictionaries = Object.fromEntries(await Promise.all(languages.map(async (language) => {
	const raw = await readFile(join(localeDir, `${language}.json`), 'utf8');
	return [language, flatten(JSON.parse(raw))];
})));

const canonicalKeys = [...dictionaries.en.keys()].sort();
const errors = [];
const allowedLiteralLabels = new Set(['A', 'All', 'Stay', 'Ari', 'EN', 'ID', 'PHOTO']);

for (const language of languages.slice(1)) {
	const keys = [...dictionaries[language].keys()].sort();
	for (const missing of canonicalKeys.filter((key) => !dictionaries[language].has(key))) {
		errors.push(`${language}.json is missing key: ${missing}`);
	}
	for (const extra of keys.filter((key) => !dictionaries.en.has(key))) {
		errors.push(`${language}.json has extra key: ${extra}`);
	}
}

for (const key of canonicalKeys) {
	const expected = placeholders(dictionaries.en.get(key)).join(',');
	for (const language of languages.slice(1)) {
		const actual = placeholders(dictionaries[language].get(key) ?? '').join(',');
		if (actual !== expected) errors.push(`${language}.${key} placeholders differ: expected {${expected}}, got {${actual}}`);
	}
}

for (const file of await sourceFiles(join(root, 'src'))) {
	const source = await readFile(file, 'utf8');
	const label = relative(root, file);
	for (const match of source.matchAll(/\$_\(\s*['"]([^'"]+)['"]/g)) {
		if (!dictionaries.en.has(match[1])) errors.push(`${label} references unknown key: ${match[1]}`);
	}
	if (/\b(?:name|description|desc|cuisine)\s*\[\s*\$language\s*\]/.test(source)) {
		errors.push(`${label} indexes localized content directly; use localize() so fallback is guaranteed`);
	}

	if (extname(file) === '.svelte') {
		let markup = source
			.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
			.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
			.replace(/<!--[\s\S]*?-->/g, '');
		let previous;
		do {
			previous = markup;
			markup = markup.replace(/\{[^{}]*\}/g, '');
		} while (markup !== previous);
		for (const match of markup.matchAll(/>([^<{]*[A-Za-z][^<{]*)</g)) {
			const literal = match[1].replace(/\s+/g, ' ').trim();
			if (literal && !allowedLiteralLabels.has(literal)) errors.push(`${label} contains untranslated UI text: ${literal}`);
		}
		for (const match of markup.matchAll(/(?:placeholder|aria-label)="([^"]*[A-Za-z][^"]*)"/g)) {
			errors.push(`${label} contains untranslated attribute text: ${match[1]}`);
		}
	}
}

if (errors.length) {
	console.error(`i18n validation failed (${errors.length}):\n- ${errors.join('\n- ')}`);
	process.exitCode = 1;
} else {
	console.log(`i18n validation passed: ${canonicalKeys.length} keys across ${languages.join(', ')}`);
}
