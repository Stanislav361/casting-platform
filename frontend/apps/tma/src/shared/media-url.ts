/**
 * Единая точка приведения ссылок на медиа (фото актёров, обложки, видео) к
 * адресу, который реально откроется в браузере.
 *
 * Зачем это нужно. В базе лежат ссылки трёх видов:
 *  1. Абсолютные на S3 — открываются как есть.
 *  2. Относительные `/uploads/...` — это файлы, отданные самим API (локальный
 *     фолбэк, когда загрузка в S3 не удалась). Их нужно склеить с адресом API.
 *  3. Абсолютные на localhost/старый домен с путём `/uploads/...` — их тоже
 *     нужно переписать на текущий API, иначе картинка не загрузится.
 *
 * Главная тонкость: API может жить не в корне домена, а по префиксу
 * (например `https://prostoprobuy.pro/api/` — запросы идут через прокси).
 * Раньше здесь брался только `origin`, префикс `/api` терялся, и все ссылки
 * вида `/uploads/...` уходили на фронтенд вместо API — отсюда массовые битые
 * картинки. Поэтому склеиваем путь ОТ базового пути API, а не от корня домена.
 */
import { API_URL } from '~/shared/api-url'

function apiBaseUrl(): URL {
	const origin = typeof window !== 'undefined' ? window.location.origin : undefined
	return new URL(API_URL, origin)
}

export function normalizeMediaUrl(url?: string | null): string | null {
	if (!url) return null
	try {
		const apiBase = apiBaseUrl()
		const parsed = new URL(url, apiBase)

		if (parsed.pathname.startsWith('/uploads/')) {
			// Склеиваем с базовым путём API, сохраняя его префикс:
			// API `https://host/api/` + `/uploads/x.jpg` → `https://host/api/uploads/x.jpg`.
			const rebuilt = new URL(
				`${parsed.pathname.replace(/^\/+/, '')}${parsed.search}`,
				apiBase,
			)
			return rebuilt.toString()
		}

		// Смешанный контент: на HTTPS-странице браузер молча блокирует http-картинки.
		if (
			parsed.protocol === 'http:' &&
			typeof window !== 'undefined' &&
			window.location.protocol === 'https:' &&
			parsed.hostname !== 'localhost' &&
			parsed.hostname !== '127.0.0.1'
		) {
			parsed.protocol = 'https:'
		}

		return parsed.toString()
	} catch {
		return url
	}
}

/**
 * Фото для карточки актёра.
 *
 * Thumbnail имеет размер всего 300×300 и на Retina-экранах заметно
 * растягивается. Сначала используем обработанное фото высокого разрешения, а
 * миниатюру оставляем только последним запасным вариантом.
 */
export function getActorPhotoFromAssets(actor: {
	media_assets?: Array<{
		file_type?: string | null
		processed_url?: string | null
		thumbnail_url?: string | null
		original_url?: string | null
		is_primary?: boolean | null
	}> | null
	photo_url?: string | null
} | null | undefined): string | null {
	const photos = (actor?.media_assets || []).filter(m => m.file_type === 'photo')
	const primary = photos.find(m => m.is_primary)
	return normalizeMediaUrl(
		primary?.processed_url ||
		primary?.original_url ||
		primary?.thumbnail_url ||
		photos[0]?.processed_url ||
		photos[0]?.original_url ||
		photos[0]?.thumbnail_url ||
		actor?.photo_url ||
		null,
	)
}
