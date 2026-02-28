import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
	ResponseActorRepository,
	ResponseCastingRepository,
} from '~models/response/response.repository'

import {
	ActorID,
	CastingID,
	responseConfig,
	UseResponsesActors,
	UseResponsesCastings,
} from '@prostoprobuy/models'

export const useActorResponses = (
	actor: ActorID,
	params?: Partial<UseResponsesActors>,
) => {
	return useQuery({
		queryKey: [responseConfig.responsesActors, actor, params],
		queryFn: () => ResponseActorRepository.all(actor, params),
		placeholderData: keepPreviousData,
	})
}

export const useCastingResponses = (
	casting: CastingID,
	params?: Partial<UseResponsesCastings>,
) => {
	return useQuery({
		queryKey: [responseConfig.responsesCastings, casting, params],
		queryFn: () => ResponseCastingRepository.all(casting, params),
		placeholderData: keepPreviousData,
	})
}
