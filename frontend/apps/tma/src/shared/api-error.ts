/**
 * Достать из ответа бэкенда сообщение, которое можно показать человеку.
 *
 * Бэкенд отвечает об ошибке тремя разными способами: строкой в `detail`,
 * объектом `{ code, message }` и — когда запрос не прошёл проверку схемы —
 * массивом FastAPI, где текст лежит в `detail[].msg`. Экраны разбирали только
 * первые два, поэтому любая ошибка проверки схемы превращалась в общее «Ошибка
 * при создании профиля»: человек видел, что не получилось, но не то, какое поле
 * поправить, и шёл в поддержку. Здесь все три формы сводятся к одному тексту.
 */

/** Префикс, которым pydantic помечает сообщения из своих валидаторов. */
const PYDANTIC_PREFIXES = ['Value error, ', 'Assertion failed, ']

/** Поля, чьё техническое имя человеку ничего не скажет — подписываем по-русски. */
const FIELD_LABELS: Record<string, string> = {
	email: 'Email',
	phone_number: 'Телефон',
	date_of_birth: 'Дата рождения',
	first_name: 'Имя',
	last_name: 'Фамилия',
	display_name: 'Имя для отображения',
	height: 'Рост',
	clothing_size: 'Размер одежды',
	shoe_size: 'Размер обуви',
	city: 'Город',
	about_me: 'О себе',
	video_intro: 'Видеовизитка',
	extra_portfolio_url: 'Ссылка на портфолио',
}

function stripPydanticPrefix(message: string): string {
	for (const prefix of PYDANTIC_PREFIXES) {
		if (message.startsWith(prefix)) return message.slice(prefix.length)
	}
	return message
}

/**
 * Имя поля из `loc` FastAPI: последний элемент, кроме служебного `body`.
 * Индексы элементов списка пропускаем — человеку нужно название поля.
 */
function fieldNameFromLoc(loc: unknown): string | null {
	if (!Array.isArray(loc)) return null
	for (let i = loc.length - 1; i >= 0; i -= 1) {
		const part = loc[i]
		if (typeof part === 'string' && part !== 'body' && part !== 'query' && part !== 'path') {
			return part
		}
	}
	return null
}

function messageFromValidationItem(item: unknown): string | null {
	if (!item || typeof item !== 'object') return null
	const raw = (item as { msg?: unknown }).msg
	if (typeof raw !== 'string' || !raw.trim()) return null

	const text = stripPydanticPrefix(raw.trim())
	const field = fieldNameFromLoc((item as { loc?: unknown }).loc)
	const label = field ? FIELD_LABELS[field] : null

	// Своё сообщение уже написано по-русски и объясняет, что делать, — подпись
	// поля к нему только мешает. Подписываем лишь стандартные тексты pydantic,
	// которые сами по себе не говорят, о каком поле речь.
	if (!label || text !== raw.trim()) return text
	return `${label}: ${text}`
}

/**
 * Текст ошибки для показа человеку. `fallback` используется, только если в
 * ответе не нашлось ничего осмысленного.
 */
export function apiErrorMessage(response: unknown, fallback: string): string {
	if (typeof response === 'string' && response.trim()) return response.trim()
	if (!response || typeof response !== 'object') return fallback

	const source = response as { detail?: unknown; message?: unknown }
	const detail = source.detail

	if (typeof detail === 'string' && detail.trim()) return detail.trim()

	if (Array.isArray(detail)) {
		const messages = detail
			.map(messageFromValidationItem)
			.filter((text): text is string => Boolean(text))
		// Показываем все проблемы сразу: иначе человек правит по одной,
		// отправляет заново и получает следующую.
		if (messages.length) return Array.from(new Set(messages)).join('\n')
	}

	if (detail && typeof detail === 'object') {
		const message = (detail as { message?: unknown }).message
		if (typeof message === 'string' && message.trim()) return message.trim()
	}

	if (typeof source.message === 'string' && source.message.trim()) {
		return source.message.trim()
	}

	return fallback
}
