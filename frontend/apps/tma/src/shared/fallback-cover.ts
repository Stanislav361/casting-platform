const FALLBACK_COVER_IMAGES = [
	'/fallback-covers/01.png',
	'/fallback-covers/02.png',
	'/fallback-covers/03.png',
	'/fallback-covers/04.png',
	'/fallback-covers/05.png',
	'/fallback-covers/06.png',
	'/fallback-covers/07.png',
	'/fallback-covers/08.png',
	'/fallback-covers/09.png',
	'/fallback-covers/10.png',
	'/fallback-covers/11.png',
	'/fallback-covers/12.png',
]

const N = FALLBACK_COVER_IMAGES.length

/** Хэш-функция для детерминированного seed-а. */
const hashSeed = (seed?: string | number | null): number => {
	const value = String(seed ?? 'fallback-cover')
	let h = 0
	for (let i = 0; i < value.length; i++) {
		h = (h * 31 + value.charCodeAt(i)) >>> 0
	}
	return h
}

/**
 * Возвращает fallback-обложку по seed.
 * Если передан itemIndex (позиция в списке), гарантирует что
 * соседние элементы никогда не получат одну и ту же картинку:
 * используем itemIndex напрямую, чтобы обходить массив по-кругу.
 */
export const getFallbackCoverImage = (seed?: string | number | null, itemIndex?: number): string => {
	if (itemIndex !== undefined) {
		return FALLBACK_COVER_IMAGES[itemIndex % N]
	}
	return FALLBACK_COVER_IMAGES[hashSeed(seed) % N]
}

/**
 * Если у элемента есть своя картинка — берёт её.
 * Иначе — fallback. При рендере списка передавайте itemIndex (idx из .map),
 * тогда гарантируется чередование без повторений подряд.
 */
export const getCoverImage = (
	imageUrl?: string | null,
	seed?: string | number | null,
	itemIndex?: number,
): string => imageUrl || getFallbackCoverImage(seed, itemIndex)
