'use client'

import { useEffect, useState } from 'react'
import { $session } from '@prostoprobuy/models'

export type AppRole =
	| 'owner'
	| 'employer_pro'
	| 'employer'
	| 'administrator'
	| 'manager'
	| 'agent'
	| 'user'
	| null

function extractRole(accessToken?: string | null): AppRole {
	if (!accessToken) return null
	try {
		const payloadB64 = accessToken.split('.')[1]
		if (!payloadB64) return null
		const payload = JSON.parse(atob(payloadB64))
		return (payload.role as AppRole) || null
	} catch {
		return null
	}
}

export function useRole(): AppRole {
	const [role, setRole] = useState<AppRole>(() => {
		if (typeof window === 'undefined') return null
		return extractRole($session.getState()?.access_token)
	})

	useEffect(() => {
		// Немедленно синхронизируем — на случай, если state успел измениться
		// между инициализацией useState и монтированием эффекта.
		setRole(extractRole($session.getState()?.access_token))

		// ВАЖНО: подписываемся на watch ВСЕГДА, даже если токена сейчас нет.
		// Иначе после появления токена (login/refresh/restore) роль не обновится.
		const unsubscribe = $session.watch((s) => {
			setRole(extractRole(s?.access_token))
		})
		return unsubscribe
	}, [])

	return role
}
