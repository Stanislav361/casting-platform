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

export function useRole(): AppRole {
	const [role, setRole] = useState<AppRole>(null)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) return
		try {
			const payload = JSON.parse(atob(session.access_token.split('.')[1]))
			setRole((payload.role as AppRole) || null)
		} catch {
			setRole(null)
		}

		const unsubscribe = $session.watch((s) => {
			if (!s?.access_token) { setRole(null); return }
			try {
				const payload = JSON.parse(atob(s.access_token.split('.')[1]))
				setRole((payload.role as AppRole) || null)
			} catch {
				setRole(null)
			}
		})
		return unsubscribe
	}, [])

	return role
}
