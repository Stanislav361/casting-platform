'use client'

import { useDeferredValue } from 'react'

import { ResponseCastingCard } from '~models/response'

import { IResponseCasting } from '@prostoprobuy/models'

interface ResponseCastingListProps {
	responses: IResponseCasting[]
}

export const renderResponseCastingCard = (response: IResponseCasting) => (
	<ResponseCastingCard key={response.id} response={response} />
)

export function ResponseCastingList({ responses }: ResponseCastingListProps) {
	const list = useDeferredValue(responses, [])

	return list.map(renderResponseCastingCard)
}
