/**
 * Persisted return URL across the auth flow.
 *
 * Use case: a user lands on a deep link (e.g. casting page from a Telegram
 * channel post) without an authenticated session. We send them through the
 * login funnel, and after auth completes they should land back on the
 * original page instead of the generic home/dashboard.
 *
 * The value is stored in `localStorage` so it survives full-page redirects
 * (Telegram OAuth, Yandex code exchange, etc.) and is consumed exactly once.
 */
const STORAGE_KEY = 'pp_pending_return_url'

const isSafeInternalUrl = (url: string): boolean => {
	if (!url || typeof url !== 'string') return false
	if (!url.startsWith('/')) return false
	if (url.startsWith('//')) return false
	return true
}

export const setPendingReturnUrl = (url: string | null | undefined) => {
	if (typeof window === 'undefined') return
	if (!url || !isSafeInternalUrl(url)) {
		window.localStorage.removeItem(STORAGE_KEY)
		return
	}
	window.localStorage.setItem(STORAGE_KEY, url)
}

export const getPendingReturnUrl = (): string | null => {
	if (typeof window === 'undefined') return null
	const value = window.localStorage.getItem(STORAGE_KEY)
	if (!value || !isSafeInternalUrl(value)) return null
	return value
}

export const clearPendingReturnUrl = () => {
	if (typeof window === 'undefined') return
	window.localStorage.removeItem(STORAGE_KEY)
}

/**
 * Try to consume a pending return URL — returns the saved URL (and clears
 * it) or `null` if nothing was stored. Use this after a successful login.
 */
export const consumePendingReturnUrl = (): string | null => {
	const url = getPendingReturnUrl()
	if (url) clearPendingReturnUrl()
	return url
}
