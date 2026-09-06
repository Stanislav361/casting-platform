/**
 * Поиск актёра в списках, которые фильтруются на клиенте.
 *
 * Имя человека лежит не в одном поле. У анкет, заполненных в приложении, есть
 * `first_name` и `last_name`. У перенесённых из старой базы и у актёров,
 * заведённых агентом, имя часто заполнено только в `display_name`, причём в
 * обратном порядке — «Фамилия Имя». Пока поиск сравнивал запрос как одну
 * подстроку и смотрел лишь в имя с фамилией, «Александр Кулик» не находил
 * никого, а часть актёров не находилась вообще ни по какому запросу.
 *
 * Правила совпадают с серверными (см. services/core/shared/search.py):
 *
 * * каждое слово запроса должно встретиться хоть в одном поле — тогда «Кулик»,
 *   «Александр Кулик» и «Кулик Александр» находят одного и того же человека;
 * * «ё» и «е» считаются одной буквой: «Артем» находит Артёма и наоборот.
 */

export type SearchableActor = {
	first_name?: string | null
	last_name?: string | null
	display_name?: string | null
	city?: string | null
	metro_station?: string | null
}

// Больше слов — это уже не поиск по имени, а случайно вставленный текст.
const MAX_QUERY_WORDS = 6

/**
 * Приводим строку к виду, в котором её можно сравнивать: нижний регистр, «ё» как
 * «е», любые пробелы (мобильные клавиатуры вставляют и неразрывные) — как один
 * обычный.
 */
function fold(value: string): string {
	return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

/** Слова запроса. Пустой запрос даёт пустой список — значит, подходит любой актёр. */
export function actorSearchWords(query: string): string[] {
	const folded = fold(query)
	if (!folded) return []
	return folded.split(' ').filter(Boolean).slice(0, MAX_QUERY_WORDS)
}

/** Всё, по чему ищем одного актёра, одной строкой. */
export function actorSearchText(actor: SearchableActor): string {
	return fold(
		[actor.display_name, actor.first_name, actor.last_name, actor.city, actor.metro_station]
			.filter(Boolean)
			.join(' '),
	)
}

/** Подходит ли актёр под уже разобранный запрос. */
export function matchesActorWords(actor: SearchableActor, words: string[]): boolean {
	if (words.length === 0) return true
	const text = actorSearchText(actor)
	return words.every(word => text.includes(word))
}

/**
 * Имя актёра для карточки.
 *
 * Показываем то же, по чему ищем: иначе карточка подписана «Актёр», а найти его
 * по имени нельзя — человек считает, что поиск сломан.
 */
export function actorDisplayName(actor: SearchableActor, fallback = 'Актёр'): string {
	const full = [actor.first_name, actor.last_name].filter(Boolean).join(' ').trim()
	if (full) return full
	return (actor.display_name || '').trim() || fallback
}
