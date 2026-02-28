'use client'

import { useDeferredValue } from 'react'

import { CastingCard, IListCasting } from '~models/casting'

interface CastingListProps {
	castings: IListCasting[]
}

export const renderCastingCard = (casting: IListCasting) => {
	return <CastingCard key={casting.id} casting={casting} />
}

export function CastingList({ castings }: CastingListProps) {
	const list = useDeferredValue(castings, [])

	return list.map(renderCastingCard)
}
