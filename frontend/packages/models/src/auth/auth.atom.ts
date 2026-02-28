import { createEvent, createStore } from 'effector'
import { persist } from 'effector-storage/local'

import { domain } from '@prostoprobuy/toolkit'

import { ISession } from './auth.types'
import { SESSION_INITIAL_STATE } from './auth.utils'

export const session = domain(() => {
	const login = createEvent<ISession>()
	const logout = createEvent()

	const $session = createStore<ISession>(SESSION_INITIAL_STATE)

	$session.on(login, (state, payload) => ({ ...state, ...payload }))
	$session.reset(logout)

	persist({
		store: $session,
		key: 'session-storage',
	})

	return {
		login,
		logout,
		$session,
	}
})

export const { login, logout, $session } = session
