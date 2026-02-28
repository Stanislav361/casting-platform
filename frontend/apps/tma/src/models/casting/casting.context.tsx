'use client'

import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useMemo,
} from 'react'

import { setCasting } from '~models/casting/casting.atom'

import { useCastingParam } from '~packages/hooks'

import { CastingID } from '@prostoprobuy/models'
import { Nullable } from '@prostoprobuy/types'

export type CastingContextType = {
	casting: CastingID
	getting: boolean
}

export const CastingContext = createContext<Nullable<CastingContextType>>(null)

export const CastingProvider = ({ children }: PropsWithChildren) => {
	const casting = useCastingParam()

	useEffect(() => {
		setCasting({
			casting,
			has_applied: false,
		})
	}, [casting])

	const memoized: CastingContextType = useMemo(
		() => ({ casting, getting: !casting }),
		[casting],
	)

	return <CastingContext value={memoized}>{children}</CastingContext>
}

export const useCastingID = () => {
	const context = useContext(CastingContext)
	if (!context) {
		throw new Error('useCastingID must be used within a CastingProvider')
	}
	return context
}
