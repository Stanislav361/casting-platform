import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
} from '@tanstack/react-query'

import { CastingRepository } from '~models/casting/casting.repository'
import { ICasting } from '~models/casting/casting.types'

import { castingConfig, CastingID, UseCastings } from '@prostoprobuy/models'
import { ListResponse } from '@prostoprobuy/types'

export const useCastings = (params?: Partial<UseCastings>) => {
	return useQuery({
		queryKey: [castingConfig.castings, params],
		queryFn: () => CastingRepository.all(params),
		placeholderData: keepPreviousData,
	})
}

export const useCasting = (id: CastingID) => {
	return useQuery({
		queryKey: [castingConfig.casting, id],
		queryFn: () => CastingRepository.getById(id),
		enabled: !!id,
	})
}

export const useInfinityCastings = (params?: Partial<UseCastings>) => {
	return useInfiniteQuery({
		queryKey: [castingConfig.infiniteCastings, params],
		queryFn: ({ pageParam }) => {
			return CastingRepository.all({
				...params,
				page_number: Number(pageParam),
			})
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage, _allPages, lastPageParam) => {
			const totalPages = lastPage?.data?.meta?.total_pages ?? 1
			if (!totalPages || lastPageParam >= totalPages) {
				return undefined
			}
			return lastPageParam + 1
		},
		select: ({ pages, pageParams }) => ({
			pages: pages.map(page => page.data as ListResponse<ICasting>),
			pageParams,
		}),
		throwOnError: true,
		refetchOnWindowFocus: false,
	})
}
