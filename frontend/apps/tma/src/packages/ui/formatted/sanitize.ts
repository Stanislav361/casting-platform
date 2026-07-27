/**
 * Санитайзер пользовательского текста перед выводом в разметку.
 *
 * Работает по принципу «запрещено всё, что не разрешено явно»:
 *   1. сначала экранируется ВЕСЬ ввод — после этого шага в строке физически не
 *      остаётся работающей разметки, только текст;
 *   2. затем возвращаются несколько тегов форматирования, причём строго без
 *      атрибутов, поэтому подставить в них onerror/onclick невозможно;
 *   3. ссылки собираются заново нами самими и только после проверки схемы
 *      адреса, что отсекает javascript: и data:.
 *
 * Такой порядок безопасен by design: в результат попадает только та разметка,
 * которую сформировал этот модуль.
 */

const ESCAPE_MAP: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
}

const escapeHtml = (value: string): string =>
	value.replace(/[&<>"']/g, character => ESCAPE_MAP[character])

const unescapeHtml = (value: string): string =>
	value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'code'] as const
const SELF_CLOSING_TAGS = ['br'] as const

/** Замены готовятся один раз при загрузке модуля: описания рендерятся списками. */
const TAG_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
	...ALLOWED_TAGS.flatMap(tag => [
		[new RegExp(`&lt;${tag}&gt;`, 'gi'), `<${tag}>`] as const,
		[new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`] as const,
	]),
	...SELF_CLOSING_TAGS.map(
		tag => [new RegExp(`&lt;${tag}\\s*/?&gt;`, 'gi'), `<${tag}>`] as const,
	),
]

/** Разрешены только явно безопасные схемы и никаких символов, которыми можно разорвать атрибут. */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|tg:\/\/)[^\s"'<>`]+$/i

/** Открывающий тег ссылки уже в экранированном виде: href в двойных или одинарных кавычках. */
const ESCAPED_ANCHOR_OPEN = /&lt;a\s+href=(?:&quot;|&#39;)(.*?)(?:&quot;|&#39;)[^&]*?&gt;/gi

const ESCAPED_ANCHOR_CLOSE = /&lt;\/a&gt;/gi

export const sanitizeRichText = (value: string | null | undefined): string => {
	if (value === null || value === undefined) return ''

	const source = String(value)
	if (!source) return ''

	let safe = escapeHtml(source)

	for (const [pattern, replacement] of TAG_REPLACEMENTS) {
		safe = safe.replace(pattern, replacement)
	}

	safe = safe.replace(ESCAPED_ANCHOR_OPEN, (_match, rawHref: string) => {
		const href = unescapeHtml(rawHref).trim()
		if (!SAFE_HREF.test(href)) return ''
		return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">`
	})
	safe = safe.replace(ESCAPED_ANCHOR_CLOSE, '</a>')

	return safe
}
