'use client'

import {
	setFilter,
	useReportRefFavoritesStore,
} from '~widgets/report-ref-favorites'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const ReportRefFavoritesPagination = () => {
	const { filter, count, loading } = useReportRefFavoritesStore()

	const setPage = useMemoizedFn(page => setFilter({ page_number: page }))

	return (
		<Pagination
			total={count}
			limit={filter.page_size}
			page={filter.page_number}
			isLoading={loading}
			onPageChange={setPage}
		/>
	)
}
