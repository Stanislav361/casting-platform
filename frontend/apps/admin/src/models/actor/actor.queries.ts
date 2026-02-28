import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { ActorRepository } from '~models/actor/actor.repository'

import { actorConfig, ActorID, UseActors } from '@prostoprobuy/models'

export const useActors = (params?: Partial<UseActors>) => {
	return useQuery({
		queryKey: [actorConfig.actors, params],
		queryFn: () => ActorRepository.all(params),
		placeholderData: keepPreviousData,
	})
}

export const useActor = (id: ActorID) => {
	return useQuery({
		queryKey: [actorConfig.actor, id],
		queryFn: () => ActorRepository.getById(id),
		enabled: !!id,
	})
}
