'use client'

import { useDeferredValue } from 'react'

import { ResponseActorCard } from '~models/response'

import { IResponseActor } from '@prostoprobuy/models'

interface ResponseActorListProps {
	responses: IResponseActor[]
}

export const renderResponseActorCard = (response: IResponseActor) => (
	<ResponseActorCard key={response.id} response={response} />
)

export function ResponseActorList({ responses }: ResponseActorListProps) {
	const list = useDeferredValue(responses, [])

	return list.map(renderResponseActorCard)
}
