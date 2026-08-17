/**
 * Сохранение файла, полученного от API, на устройство пользователя.
 *
 * Каст лист приходит бинарным ответом (а не ссылкой), поэтому скачивание
 * инициируется из браузера: так работает и публичная ссылка в обычном
 * браузере, и кабинет внутри Telegram Mini App.
 */

const FALLBACK_FILENAME = 'cast-list.pdf'

/**
 * Достать имя файла из заголовка `Content-Disposition`.
 *
 * Бэкенд отдаёт и `filename*=UTF-8''…` (русское название), и ASCII-фолбэк.
 * Приоритет у UTF-8 варианта — иначе пользователь получит транслит.
 */
export function parseContentDispositionFilename(
	header?: string | null,
	fallback: string = FALLBACK_FILENAME,
): string {
	if (!header) return fallback

	const utf8Match = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
	if (utf8Match?.[1]) {
		try {
			const decoded = decodeURIComponent(utf8Match[1].trim())
			if (decoded) return sanitizeFilename(decoded, fallback)
		} catch {
			/* повреждённое percent-encoding — пробуем ASCII-вариант ниже */
		}
	}

	const asciiMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(header)
	if (asciiMatch?.[1]) return sanitizeFilename(asciiMatch[1].trim(), fallback)

	return fallback
}

/**
 * Убрать из имени разделители путей и управляющие символы — иначе браузер
 * может отвергнуть скачивание или сохранить файл не туда.
 */
function sanitizeFilename(name: string, fallback: string): string {
	const cleaned = Array.from(name)
		.map(char => (char.charCodeAt(0) < 0x20 || char === '/' || char === '\\' ? ' ' : char))
		.join('')
		.replace(/\s+/g, ' ')
		.trim()
	return cleaned || fallback
}

/**
 * Отдать файл пользователю самым надёжным для его устройства способом.
 *
 * На iPhone и iPad атрибут `download` не работает: Safari игнорирует его для
 * `blob:` и просто показывает PDF во встроенном просмотрщике. Файл при этом
 * никуда не сохраняется, а кнопка «Поделиться» в просмотрщике отдаёт адрес
 * страницы вместо документа — получатель открывает нерабочую ссылку. Поэтому
 * на Apple-устройствах сразу отдаём сам файл в системный лист «Поделиться»:
 * оттуда его можно отправить в Telegram или сохранить в «Файлы».
 *
 * Везде остальном (обычный браузер на компьютере) привычнее скачивание в
 * папку загрузок, поэтому там ничего не меняется.
 */
export async function deliverBlobAsFile(
	blob: Blob,
	filename: string,
): Promise<'shared' | 'saved' | 'cancelled'> {
	if (typeof window === 'undefined') return 'saved'

	const name = filename || FALLBACK_FILENAME

	if (isAppleMobile()) {
		const file = new File([blob], name, { type: blob.type || 'application/pdf' })
		if (navigator.canShare?.({ files: [file] })) {
			try {
				await navigator.share({ files: [file], title: name })
				return 'shared'
			} catch (err) {
				// Пользователь закрыл лист «Поделиться» — это не ошибка, повторно
				// ничего не навязываем.
				if ((err as Error)?.name === 'AbortError') return 'cancelled'
				// Остальные причины (жест «истёк» за время запроса, WebView без
				// поддержки) — уходим на обычное сохранение ниже.
			}
		}
	}

	saveBlobAsFile(blob, name)
	return 'saved'
}

/**
 * iPhone/iPad, включая iPadOS, который представляется как macOS: отличаем его
 * по наличию нескольких точек касания.
 */
function isAppleMobile(): boolean {
	if (typeof navigator === 'undefined') return false
	const ua = navigator.userAgent || ''
	if (/iPad|iPhone|iPod/.test(ua)) return true
	return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1
}

/**
 * Сохранить Blob как файл.
 *
 * Основной путь — «клик» по скрытой ссылке с атрибутом `download`. Там, где он
 * не поддерживается (старые встроенные WebView), открываем файл в новой
 * вкладке: пользователь сохранит его сам из просмотрщика PDF.
 */
export function saveBlobAsFile(blob: Blob, filename: string): void {
	if (typeof window === 'undefined') return

	const objectUrl = URL.createObjectURL(blob)
	const supportsDownload =
		typeof HTMLAnchorElement !== 'undefined' && 'download' in HTMLAnchorElement.prototype

	try {
		if (supportsDownload) {
			const link = document.createElement('a')
			link.href = objectUrl
			link.download = filename || FALLBACK_FILENAME
			link.rel = 'noopener'
			link.style.display = 'none'
			document.body.appendChild(link)
			link.click()
			link.remove()
		} else {
			window.open(objectUrl, '_blank', 'noopener,noreferrer')
		}
	} finally {
		// Отзываем ссылку с запасом: скачивание/открытие стартует асинхронно,
		// и слишком ранний revoke обрывает его.
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
	}
}
