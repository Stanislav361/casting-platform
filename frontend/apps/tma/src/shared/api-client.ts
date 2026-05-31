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
