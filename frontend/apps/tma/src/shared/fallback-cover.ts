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

export const getFallbackCoverImage = (seed?: string | number | null) => {
	const value = String(seed ?? 'fallback-cover')
	let hash = 0

	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0
	}

	return FALLBACK_COVER_IMAGES[hash % FALLBACK_COVER_IMAGES.length]
}

export const getCoverImage = (imageUrl?: string | null, seed?: string | number | null) =>
	imageUrl || getFallbackCoverImage(seed)
