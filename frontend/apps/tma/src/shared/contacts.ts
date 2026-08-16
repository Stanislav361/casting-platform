/**
 * Приведение способов связи к единому виду — те же правила, что на бэкенде
 * (`services/core/shared/contacts.py`).
 *
 * Люди пишут контакт как придётся: «@nick», «nick», «t.me/nick», «T.me/Nick»,
 * «https://t.me/nick», «vk.com/id5426337». Нормализуем на клиенте, чтобы
 * человек сразу видел, в каком виде контакт сохранится, а проверка «указан ли
 * хотя бы один способ связи» совпадала с серверной — иначе форма пропускала
 * заполненное поле, а сервер его не принимал.
 */

const TELEGRAM_PREFIXES = [
	'https://t.me/',
	'http://t.me/',
	'https://telegram.me/',
	'http://telegram.me/',
	't.me/',
	'telegram.me/',
]

const VK_PREFIXES = [
	'https://vk.com/',
	'http://vk.com/',
	'https://m.vk.com/',
	'http://m.vk.com/',
	'https://vk.ru/',
	'http://vk.ru/',
	'm.vk.com/',
	'vk.com/',
	'vk.ru/',
]

const MAX_PREFIXES = [
	'https://max.ru/',
	'http://max.ru/',
	'https://web.max.ru/',
	'http://web.max.ru/',
	'web.max.ru/',
	'max.ru/',
]

/**
 * Ник, к которому можно безопасно приписать «@» или «vk.com/». Всё остальное
 * (кириллица, пробелы) оставляем как набрали: лучше сохранить непонятное
 * значение, чем изуродовать то, что человек имел в виду.
 */
const NICK_RE = /^[A-Za-z0-9._-]{2,64}$/
const PHONE_RE = /^\+?[\d\s\-()]{5,20}$/

const MIN_CONTACT_LENGTH = 2

function clean(value: string | null | undefined, prefixes: string[]): string {
	if (!value) return ''
	let text = String(value).replace(/\u00a0/g, ' ').trim()
	text = text.split('?')[0]
	const lowered = text.toLowerCase()
	for (const prefix of prefixes) {
		if (lowered.startsWith(prefix)) {
			text = text.slice(prefix.length)
			break
		}
	}
	return text.trim().replace(/^@+/, '').replace(/^\/+|\/+$/g, '').trim()
}

export function canonicalTelegram(value: string | null | undefined): string {
	const cleaned = clean(value, TELEGRAM_PREFIXES)
	if (!cleaned) return ''
	if (PHONE_RE.test(cleaned)) return cleaned
	return NICK_RE.test(cleaned) ? `@${cleaned}` : cleaned
}

export function canonicalVk(value: string | null | undefined): string {
	const cleaned = clean(value, VK_PREFIXES)
	if (!cleaned) return ''
	return NICK_RE.test(cleaned) ? `vk.com/${cleaned}` : cleaned
}

export function canonicalMax(value: string | null | undefined): string {
	const cleaned = clean(value, MAX_PREFIXES)
	if (!cleaned) return ''
	if (PHONE_RE.test(cleaned)) return cleaned
	return NICK_RE.test(cleaned) ? `@${cleaned}` : cleaned
}

/** Похоже ли значение на настоящий контакт, а не на «@» или «-». */
export function isRealContact(value: string | null | undefined, prefixes: string[]): boolean {
	return clean(value, prefixes).length >= MIN_CONTACT_LENGTH
}

export const hasTelegram = (value?: string | null) => isRealContact(value, TELEGRAM_PREFIXES)
export const hasVk = (value?: string | null) => isRealContact(value, VK_PREFIXES)
export const hasMax = (value?: string | null) => isRealContact(value, MAX_PREFIXES)

export type MessengerFields = {
	telegram_nick?: string | null
	vk_nick?: string | null
	max_nick?: string | null
}

/** Контакты в том виде, в котором их примет и сохранит сервер. */
export function normalizeMessengers(fields: MessengerFields) {
	return {
		telegram_nick: canonicalTelegram(fields.telegram_nick) || null,
		vk_nick: canonicalVk(fields.vk_nick) || null,
		max_nick: canonicalMax(fields.max_nick) || null,
	}
}

/** Указан ли хотя бы один способ связи — та же проверка, что на сервере. */
export function hasAnyMessenger(fields: MessengerFields): boolean {
	return (
		hasTelegram(fields.telegram_nick) ||
		hasVk(fields.vk_nick) ||
		hasMax(fields.max_nick)
	)
}
