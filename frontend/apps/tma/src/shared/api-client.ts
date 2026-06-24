import { $session, login, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { dialog } from '~/shared/dialog/dialog-provider'

export function getToken(): string | null {
	return $session.getState()?.access_token || null
}

/**
 * Куда вести пользователя после принудительного выхода: супер-админа (owner)
 * возвращаем на его форму входа, остальных — на обычный логин. Совпадает с
 * поведением axios-клиента (packages/lib/http).
 */
function postLogoutTarget(): string {
	try {
		const token = getToken()
		if (token) {
			const payload = JSON.parse(atob(token.split('.')[1] || ''))
			if (payload.role === 'owner') return '/admin-login'
		}
	} catch {}
	return '/login'
}

function forceLogout(): null {
	const target = postLogoutTarget()
	logout()
	if (typeof window !== 'undefined') window.location.href = target
	return null
}

/**
 * Обновление access-токена по refresh-cookie. Раньше этим занимался ТОЛЬКО
 * axios-клиент (`http`), а `apiCall` на 401 сразу разлогинивал и редиректил —
 * из-за чего при истечении токена «все кнопки переставали реагировать»
 * (страница уходила в логин). Теперь `apiCall` тоже сначала пробует обновить
 * токен и повторить запрос. Параллельные 401 разделяют один in-flight refresh.
 */
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
	if (!refreshInFlight) {
		refreshInFlight = (async () => {
			try {
				const res = await fetch(`${API_URL}auth/v2/refresh/`, {
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
				})
				if (!res.ok) return null
				const data = await res.json().catch(() => null)
				const newToken = data?.access_token
				if (!newToken) return null
				login({ access_token: newToken })
				return newToken as string
			} catch {
				return null
			}
		})()
		refreshInFlight.finally(() => { refreshInFlight = null })
	}
	return refreshInFlight
}

/**
 * GET a public (no-auth) endpoint. Unlike `apiCall`, this never redirects to
 * the login page when there is no session — used for content that anonymous
 * visitors are allowed to see (e.g. a casting opened from a Telegram link).
 * Sends the auth header opportunistically if a session exists.
 */
export async function publicGet(path: string): Promise<any> {
	try {
		const token = getToken()
		const res = await fetch(`${API_URL}${path}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		})
		const data = await res.json().catch(() => null)
		if (!res.ok && !data) return { detail: `Server error ${res.status}` }
		return data
	} catch {
		return null
	}
}

/**
 * Upload multipart/form-data (e.g. profile photos) with the bearer token.
 *
 * Unlike `apiCall`, this NEVER force-logs-out or redirects on a failed/expired
 * session. It simply returns an error object. This matters during multi-step
 * flows (like creating a profile right after registration from a Telegram
 * deep link): a transient 401 must not nuke the session and bounce the user to
 * the login screen, losing the casting they came from. Callers decide what to
 * do with the error.
 */
export async function apiUpload(method: string, path: string, formData: FormData): Promise<any> {
	const token = getToken()
	if (!token) return { detail: 'unauthorized', status: 401 }

	try {
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: { Authorization: `Bearer ${token}` },
			body: formData,
		})
		const data = await res.json().catch(() => null)
		if (!res.ok) {
			return data || { detail: `Server error ${res.status}`, status: res.status }
		}
		return data
	} catch {
		return { detail: 'network_error' }
	}
}

export async function apiCall(method: string, path: string, body?: any): Promise<any> {
	const token = getToken()
	if (!token) {
		return forceLogout()
	}

	const doFetch = (authToken: string) => fetch(`${API_URL}${path}`, {
		method,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${authToken}`,
		},
		body: body ? JSON.stringify(body) : undefined,
	})

	try {
		let res = await doFetch(token)

		// Токен истёк — пробуем обновить и повторить запрос один раз. Только если
		// обновление не удалось, выходим из аккаунта.
		if (res.status === 401) {
			const newToken = await refreshAccessToken()
			if (newToken) {
				res = await doFetch(newToken)
			}
			if (res.status === 401) {
				return forceLogout()
			}
		}

		if (res.status === 403) {
			const errData = await res.json().catch(() => null)
			if (errData?.detail && typeof errData.detail === 'string' && errData.detail.includes('заблокирован')) {
				await dialog.error({
					title: 'Доступ заблокирован',
					message: errData.detail,
				})
				return forceLogout()
			}
			return errData || { detail: 'Доступ запрещён' }
		}

		const data = await res.json().catch(() => null)
		if (!res.ok && !data) {
			return { detail: `Server error ${res.status}` }
		}
		return data
	} catch {
		return null
	}
}
