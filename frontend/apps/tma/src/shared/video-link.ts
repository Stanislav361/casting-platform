export type VideoPlayback =
	| { type: 'direct'; src: string; poster?: string | null; label?: string }
	| { type: 'embed'; src: string; label: string }
	| { type: 'external'; src: string; label: string }

function safeUrl(raw?: string | null) {
	if (!raw?.trim()) return null
	try {
		const url = new URL(raw.trim())
		return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
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

function vkEmbed(url: URL) {
	const host = url.hostname.replace(/^www\./, '')
	if (host !== 'vk.com' && host !== 'm.vk.com' && host !== 'vkvideo.ru') return null
	const match = url.pathname.match(/video(-?\d+)_(\d+)/)
	if (!match) return null
	const params = new URLSearchParams({ oid: match[1], id: match[2], hd: '2' })
	const hash = url.searchParams.get('hash')
	if (hash) params.set('hash', hash)
	return `https://vk.com/video_ext.php?${params.toString()}`
}

function googleDriveEmbed(url: URL) {
	const host = url.hostname.replace(/^www\./, '')
	if (host !== 'drive.google.com') return null
	const parts = url.pathname.split('/').filter(Boolean)
	const fileIndex = parts.indexOf('d')
	const id = fileIndex >= 0 ? parts[fileIndex + 1] : null
	return id ? `https://drive.google.com/file/d/${id}/preview` : null
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

	const vk = vkEmbed(url)
	if (vk) {
		return { type: 'embed', src: vk, label: 'VK Видео' }
	}

	const googleDrive = googleDriveEmbed(url)
	if (googleDrive) {
		return { type: 'embed', src: googleDrive, label: 'Google Диск' }
	}

	return {
		type: 'external',
		src: url.toString(),
		label: url.hostname.replace(/^www\./, ''),
	}
}
