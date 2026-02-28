'use client'

import { Nullable } from '@tanstack/react-form'
import { createEvent, createStore } from 'effector'
import { useUnit } from 'effector-react'
import { persist } from 'effector-storage/local'

import { CastingID } from '@prostoprobuy/models'
import { domain } from '@prostoprobuy/toolkit'

type CastingAtom = {
	casting: Nullable<CastingID>
	has_applied: boolean
}

export const casting = domain(() => {
	const setCasting = createEvent<CastingAtom>()
	const clearCasting = createEvent()

	const $casting = createStore<CastingAtom>({
		casting: null,
		has_applied: false,
	})

	$casting.on(setCasting, (state, payload) => ({ ...state, ...payload }))
	$casting.reset(clearCasting)

	persist({
		store: $casting,
		key: 'casting-storage',
	})

	return {
		setCasting,
		clearCasting,
		$casting,
	}
})

export const { setCasting, clearCasting, $casting } = casting

export const useCastingStore = () => useUnit($casting)
