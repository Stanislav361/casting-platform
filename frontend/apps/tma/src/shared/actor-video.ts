export type ActorVideoAsset = {
	file_type?: string | null
	processed_url?: string | null
	original_url?: string | null
	thumbnail_url?: string | null
}

export type ActorVideoSource = {
	video_intro?: string | null
	video_poster?: string | null
	media_assets?: ActorVideoAsset[] | null
}

export type ResolvedActorVideo = {
	src: string | null
	poster: string | null
}

/**
 * Единое правило выбора видеовизитки во всех анкетах.
 * Загруженный и обработанный файл приоритетнее внешней/legacy-ссылки.
 */
export function resolveActorVideo(actor?: ActorVideoSource | null): ResolvedActorVideo {
	const videoAsset = Array.isArray(actor?.media_assets)
		? actor.media_assets.find(asset => String(asset?.file_type || '').toLowerCase() === 'video')
		: undefined

	return {
		src: videoAsset?.processed_url
			|| videoAsset?.original_url
			|| actor?.video_intro
			|| null,
		poster: videoAsset?.thumbnail_url
			|| actor?.video_poster
			|| null,
	}
}
