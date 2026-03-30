export type VideoPlayback =
	| { type: 'direct'; src: string; poster?: string | null; label?: string }
	| { type: 'embed'; src: string; label: string }
	| { type: 'external'; src: string; label: string }

function safeUrl(raw?: string | null) {
	if (!raw?.trim()) return null
	try {
		return new URL(raw.trim())
	} catch {
		return null
	}
}

function youtubeEmbed(url: URL) {
	const host = url.hostname.replace(/^www\./, '')
	if (host === 'youtu.be') {
		const id = url.pathname.split('/').filter(Boolean)[0]
		return id ? `https://www.youtube.com/embed/${id}` : null
	}
	if (host === 'youtube.com' || host === 'm.youtube.com') {
		const parts = url.pathname.split('/').filter(Boolean)
		if (url.pathname === '/watch') {
			const id = url.searchParams.get('v')
			return id ? `https://www.youtube.com/embed/${id}` : null
		}
		if (parts[0] === 'shorts' && parts[1]) {
			return `https://www.youtube.com/embed/${parts[1]}`
		}
		if (parts[0] === 'embed' && parts[1]) {
			return `https://www.youtube.com/embed/${parts[1]}`
		}
	}
	return null
}

function rutubeEmbed(url: URL) {
	const host = url.hostname.replace(/^www\./, '')
	if (host !== 'rutube.ru') return null
	const parts = url.pathname.split('/').filter(Boolean)
	if (parts[0] === 'video' && parts[1]) {
		return `https://rutube.ru/play/embed/${parts[1]}`
	}
	if (parts[0] === 'play' && parts[1] === 'embed' && parts[2]) {
		return url.toString()
	}
	return null
}

function vimeoEmbed(url: URL) {
	const host = url.hostname.replace(/^www\./, '')
	if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
	const parts = url.pathname.split('/').filter(Boolean)
	const id = parts.find((part) => /^\d+$/.test(part))
	return id ? `https://player.vimeo.com/video/${id}` : null
}

export function validateVideoUrl(raw?: string | null) {
	return !!safeUrl(raw)
}

export function getVideoPlayback(
	raw?: string | null,
	options?: { poster?: string | null; label?: string },
): VideoPlayback | null {
	const url = safeUrl(raw)
	if (!url) return null

	const pathname = url.pathname.toLowerCase()
	const isDirectVideo = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?.*)?$/.test(pathname)
	if (isDirectVideo) {
		return {
			type: 'direct',
			src: url.toString(),
			poster: options?.poster,
			label: options?.label || 'Видеовизитка',
		}
	}

	const youtube = youtubeEmbed(url)
	if (youtube) {
		return { type: 'embed', src: youtube, label: 'YouTube' }
	}

	const rutube = rutubeEmbed(url)
	if (rutube) {
		return { type: 'embed', src: rutube, label: 'Rutube' }
	}

	const vimeo = vimeoEmbed(url)
	if (vimeo) {
		return { type: 'embed', src: vimeo, label: 'Vimeo' }
	}

	return {
		type: 'external',
		src: url.toString(),
		label: url.hostname.replace(/^www\./, ''),
	}
}
