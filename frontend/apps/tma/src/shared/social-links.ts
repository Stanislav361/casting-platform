// Соцсети актёра/агента (Telegram / ВКонтакте / MAX), которые пользователь
// указал в профиле. Хранятся в аккаунте как telegram_nick / vk_nick / max_nick.

export interface SocialItem {
	key: 'telegram' | 'vk' | 'max'
	label: string
	value: string
	href: string | null
}

function buildHref(key: SocialItem['key'], raw: string): string | null {
	const v = (raw || '').trim()
	if (!v) return null
	if (/^https?:\/\//i.test(v)) return v
	const handle = v.replace(/^@/, '').trim()
	if (!handle) return null
	if (key === 'telegram') return `https://t.me/${handle}`
	if (key === 'vk') return `https://vk.com/${handle}`
	if (key === 'max') return `https://max.ru/${handle}`
	return null
}

/**
 * Возвращает список заполненных соцсетей из объекта профиля/респондента.
 * Принимает любой объект с полями telegram_nick / vk_nick / max_nick.
 */
export function getProfileSocials(obj: any): SocialItem[] {
	if (!obj) return []
	const defs: Array<{ key: SocialItem['key']; label: string; field: string }> = [
		{ key: 'telegram', label: 'Telegram', field: 'telegram_nick' },
		{ key: 'vk', label: 'ВКонтакте', field: 'vk_nick' },
		{ key: 'max', label: 'MAX', field: 'max_nick' },
	]
	const items: SocialItem[] = []
	for (const d of defs) {
		const value = (obj[d.field] || '').toString().trim()
		if (value) {
			items.push({ key: d.key, label: d.label, value, href: buildHref(d.key, value) })
		}
	}
	return items
}
