'use client'

import { useQuery } from '@tanstack/react-query'

import { CastingRepository } from '~models/casting/casting.repository'

import { castingConfig, CastingID, responseConfig } from '@prostoprobuy/models'

export const useCasting = (id: CastingID) => {
	return useQuery({
		queryKey: [castingConfig.casting, id],
		queryFn: () => CastingRepository.getById(id),
		enabled: !!id,
	})
}

export const useCastingResponse = (id: CastingID) => {
	return useQuery({
		queryKey: [responseConfig.response, id],
		queryFn: () => CastingRepository.getResponse(id),
		enabled: !!id,
	})
}
