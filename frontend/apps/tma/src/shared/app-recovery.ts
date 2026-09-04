/**
 * Самовосстановление после сбоя запуска приложения.
 *
 * Два разных сбоя лечатся одинаково — полной перезагрузкой со сбросом кеша PWA:
 *
 * 1. Устаревшая сборка в кеше. Файлы Next.js (/_next/static/...) содержат хэш в
 *    имени, а service worker отдаёт их из кеша. Если в кеше осталась оболочка
 *    прошлой версии, она ссылается на чанки, которых на сервере уже нет —
 *    браузер бросает ChunkLoadError и экран остаётся пустым.
 * 2. Оборванная загрузка страницы. В логах прода это `[Error: aborted]
 *    ECONNRESET`: мобильная сеть рвёт соединение посреди ответа, приходит
 *    обрезанный HTML — падает гидрация, RSC-запрос или Server Action («Failed to
 *    find Server Action ... from an older or newer deployment»).
 *
 * В обоих случаях повторный рендер (reset() у границы ошибок React) бесполезен:
 * данные уже сломаны и лежат в кеше. Нужна именно перезагрузка с чистым кешем,
 * поэтому проверка и лечение собраны здесь и переиспользуются в глобальном
 * обработчике ошибок (app/pwa-register.tsx) и в границах ошибок React
 * (app/error-screen.tsx). Падение рендера в window.onerror не попадает — без
 * этого модуля границы ошибок лечить себя не умели вовсе.
 */
import { resetPwaCachesAndReload } from '~/shared/pwa-reset'

const ATTEMPTS_KEY = 'app-recovery-attempts'
/**
 * Сколько раз подряд позволяем себе перезагрузку. Двух попыток достаточно:
 * первая обновляет оболочку, вторая — файлы, которые успели закешироваться
 * между сбросом и перезагрузкой. Дальше причина не в кеше, и крутить страницу
 * бессмысленно — лучше показать экран ошибки с кнопкой.
 */
const MAX_ATTEMPTS = 2
/**
 * Через сколько попытки считаются несвязанными. Вкладки мобильных браузеров
 * живут неделями и переживают несколько деплоев: без этого окна первый же
 * исчерпанный лимит навсегда лишил бы вкладку самовосстановления.
 */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000

/** Сборка в кеше устарела — файлов с такими хэшами на сервере уже нет. */
const STALE_BUNDLE_MARKERS = [
	'chunkloaderror',
	'loading chunk',
	'loading css chunk',
	'failed to fetch dynamically imported module',
	'importing a module script failed',
	'error loading dynamically imported module',
]

/**
 * Страница доехала до браузера не полностью или собрана другой версией
 * приложения. Сюда же попадают минифицированные ошибки гидрации React
 * (#418, #422, #423, #425) — в проде текста у них нет, только номер.
 */
const BROKEN_STARTUP_MARKERS = [
	'failed to find server action',
	'an unexpected response was received from the server',
	'failed to fetch rsc payload',
	'connection closed',
	'hydration failed',
	'there was an error while hydrating',
	'text content does not match server-rendered html',
	'minified react error #418',
	'minified react error #422',
	'minified react error #423',
	'minified react error #425',
]

/** Текст ошибки в одну строку: имя, сообщение и стек — что удалось достать. */
export const describeError = (error: unknown): string => {
	if (!error) return ''
	if (typeof error === 'string') return error
	const err = error as { name?: string; message?: string; stack?: string }
	const parts = [err.name, err.message, err.stack].filter(Boolean)
	return parts.length ? parts.join(' ') : String(error)
}

const matches = (error: unknown, markers: string[]): boolean => {
	const text = describeError(error).toLowerCase()
	if (!text) return false
	return markers.some(marker => text.includes(marker))
}

/** Похоже ли падение на устаревшие файлы сборки в кеше. */
export const looksLikeStaleBundle = (error: unknown): boolean =>
	matches(error, STALE_BUNDLE_MARKERS)

/** Лечится ли падение перезагрузкой с чистым кешем. */
export const isRecoverableStartupFailure = (error: unknown): boolean =>
	matches(error, STALE_BUNDLE_MARKERS) || matches(error, BROKEN_STARTUP_MARKERS)

type Attempts = { count: number; at: number }

const readAttempts = (): Attempts => {
	try {
		const raw = sessionStorage.getItem(ATTEMPTS_KEY)
		if (!raw) return { count: 0, at: 0 }
		const parsed = JSON.parse(raw) as Partial<Attempts>
		const count = Number(parsed?.count) || 0
		const at = Number(parsed?.at) || 0
		// Прошлый инцидент к текущему отношения не имеет — считаем заново.
		return Date.now() - at > ATTEMPT_WINDOW_MS ? { count: 0, at: 0 } : { count, at }
	} catch {
		return { count: 0, at: 0 }
	}
}

const writeAttempts = (attempts: Attempts): void => {
	try {
		sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
	} catch {
		// sessionStorage недоступен (приватный режим) — попытка не запомнится.
	}
}

/**
 * Сбросить кеш и открыть приложение заново.
 *
 * Возвращает `false`, если лимит попыток исчерпан: тогда вызывающая сторона
 * показывает экран ошибки с кнопкой, а не уводит страницу в бесконечную
 * перезагрузку. Ручное нажатие кнопки лимитом не ограничено — человек видит
 * результат сам и решает, повторять ли.
 */
export const recoverApp = (target?: string): boolean => {
	const { count } = readAttempts()
	if (count >= MAX_ATTEMPTS) return false

	writeAttempts({ count: count + 1, at: Date.now() })
	void resetPwaCachesAndReload(target)
	return true
}
