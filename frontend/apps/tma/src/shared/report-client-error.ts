/**
 * Отправка падений браузера в журнал сервиса.
 *
 * Экран «Произошла ошибка» рисует граница ошибок React. Она перехватывает
 * падение рендера, поэтому в логи сервера не попадало ничего: на руках
 * оставались только скриншоты от клиента, а причина каждый раз восстанавливалась
 * догадками. Здесь минимальная телеметрия — текст ошибки, адрес страницы и
 * версия сборки уходят на бэкенд (POST /client-errors/) и печатаются в его лог.
 *
 * Правила: никогда не бросать исключений (иначе обработчик ошибок сам станет
 * источником ошибки) и не отправлять один и тот же текст дважды за сессию —
 * граница ошибок может перерисоваться несколько раз подряд.
 */
import { describeError } from '~/shared/app-recovery'
import { API_URL } from '~/shared/api-url'

const MAX_TEXT = 4000
const reported = new Set<string>()

export type ClientErrorSource = 'error-boundary' | 'global-error-boundary' | 'window'

type ReportPayload = {
	source: ClientErrorSource
	message: string
	digest?: string | null
	url?: string
	build_id?: string | null
	display_mode?: string
	stale_bundle?: boolean
	recovered?: boolean
}

const buildId = (): string | null => {
	const data = (globalThis as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__
	return data?.buildId ?? null
}

const displayMode = (): string => {
	try {
		if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
	} catch {
		// matchMedia недоступен — режим неважен.
	}
	// Установленное приложение открывается с этой меткой (см. manifest).
	return window.location.search.includes('source=pwa') ? 'pwa-link' : 'browser'
}

/** Отправить отчёт об ошибке. Ничего не возвращает и никогда не бросает. */
export const reportClientError = (
	error: unknown,
	source: ClientErrorSource,
	extra?: { digest?: string | null; staleBundle?: boolean; recovered?: boolean },
): void => {
	if (typeof window === 'undefined') return

	try {
		const message = describeError(error).slice(0, MAX_TEXT) || 'unknown error'
		const key = `${source}|${extra?.digest || ''}|${message}`
		if (reported.has(key)) return
		reported.add(key)

		const payload: ReportPayload = {
			source,
			message,
			digest: extra?.digest ?? null,
			url: window.location.href.slice(0, 500),
			build_id: buildId(),
			display_mode: displayMode(),
			stale_bundle: extra?.staleBundle ?? false,
			recovered: extra?.recovered ?? false,
		}

		// keepalive: отчёт должен уйти даже если страница тут же перезагружается
		// после сброса кеша — иначе самые важные падения так и не доедут.
		void fetch(`${API_URL}client-errors/`, {
			method: 'POST',
			keepalive: true,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		}).catch(() => {
			// Сеть недоступна — диагностика не критична.
		})
	} catch {
		// Диагностика не имеет права ломать экран ошибки.
	}
}
