import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
} from '@tanstack/react-query'

import { CityRepository } from '~models/city/city.repository'

import { cityConfig, ICity, UseCities } from '@prostoprobuy/models'
import { ListResponse } from '@prostoprobuy/types'

export const useCities = (params?: Partial<UseCities>) => {
	return useQuery({
		queryKey: [cityConfig.cities, params],
		queryFn: () => CityRepository.all(params),
		placeholderData: keepPreviousData,
	})
}

export const useInfinityCities = (params?: Partial<UseCities>) => {
	return useInfiniteQuery({
		queryKey: [cityConfig.infiniteCities, params],
		queryFn: ({ pageParam }) => {
			return CityRepository.all({
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
			pages: pages.map(page => page.data as ListResponse<ICity>),
			pageParams,
		}),
		throwOnError: true,
		refetchOnWindowFocus: false,
	})
}
