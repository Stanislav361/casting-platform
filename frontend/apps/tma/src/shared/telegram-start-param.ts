/**
 * Read the Telegram Mini App `start_param` (the value passed via
 * `t.me/<bot>/<app>?startapp=<value>`) from any environment we can reach:
 *
 * 1. `window.Telegram.WebApp.initDataUnsafe.start_param` — the canonical
 *    runtime location when the app is opened inside Telegram.
 * 2. `tgWebAppStartParam` query string — Telegram appends this when the
 *    Mini App opens via universal link / browser fallback.
 * 3. Plain `?start=<value>` query string — manual deeplinks for testing.
 * 4. Any `casting_<id>` chunk inside the URL hash (some clients put it
 *    there too).
 *
 * We intentionally avoid pulling `@telegram-apps/sdk-react`'s reactive
 * hooks here: this helper must work in synchronous contexts (e.g. inside
 * `useEffect` immediately after page load) and in plain browser tabs.
 */
export function readTelegramStartParam(): string {
	if (typeof window === 'undefined') return ''

	try {
		const tgRaw = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.start_param
		if (typeof tgRaw === 'string' && tgRaw.length > 0) return tgRaw
	} catch {
		// Telegram object may throw on some custom clients
	}

	try {
		const url = new URL(window.location.href)
		const fromQuery = url.searchParams.get('tgWebAppStartParam') || url.searchParams.get('start')
		if (fromQuery) return fromQuery
	} catch {
		// noop
	}

	try {
		const hash = window.location.hash || ''
		const hashSearch = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : hash.replace(/^#/, '')
		if (hashSearch) {
			const params = new URLSearchParams(hashSearch)
			const v = params.get('tgWebAppStartParam') || params.get('start_param') || params.get('start')
			if (v) return v
		}
	} catch {
		// noop
	}

	return ''
}

/**
 * Convenience: parse `start_param` directly into a casting id, e.g.
 * `casting_42` → `42`. Returns `null` for anything that does not match
 * the expected shape.
 */
export function readTelegramStartCastingId(): number | null {
	const raw = readTelegramStartParam()
	if (!raw) return null
	const match = /^casting_(\d+)$/.exec(raw)
	if (!match) return null
	const id = Number(match[1])
	return Number.isFinite(id) && id > 0 ? id : null
}
