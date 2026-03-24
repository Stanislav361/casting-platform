import { $session, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'

export function getToken(): string | null {
	return $session.getState()?.access_token || null
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

		const data = await res.json().catch(() => null)
		if (!res.ok && !data) {
			return { detail: `Server error ${res.status}` }
		}
		return data
	} catch {
		return null
	}
}
