import { $session, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { dialog } from '~/shared/dialog/dialog-provider'

export function getToken(): string | null {
	return $session.getState()?.access_token || null
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
		window.location.href = '/login'
		return null
	}

	try {
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: body ? JSON.stringify(body) : undefined,
		})

		if (res.status === 401) {
			logout()
			window.location.href = '/login/email'
			return null
		}

		if (res.status === 403) {
			const errData = await res.json().catch(() => null)
			if (errData?.detail && typeof errData.detail === 'string' && errData.detail.includes('заблокирован')) {
				logout()
				await dialog.error({
					title: 'Доступ заблокирован',
					message: errData.detail,
				})
				window.location.href = '/login'
				return null
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
