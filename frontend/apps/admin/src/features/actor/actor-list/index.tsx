'use client'

import { useDeferredValue } from 'react'

import { ActorCard } from '~models/actor'

import { IListActor } from '@prostoprobuy/models'

interface ActorListProps {
	actors: IListActor[]
}

export const renderActorCard = (actor: IListActor) => (
	<ActorCard key={actor.id} actor={actor} />
)

export function ActorList({ actors }: ActorListProps) {
	const list = useDeferredValue(actors, [])

	return list.map(renderActorCard)
}
