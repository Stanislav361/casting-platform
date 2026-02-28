'use client'

import { setFilter, useCastingResponsesStore } from '~widgets/casting-responses'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const CastingResponsesPagination = () => {
	const { filter, count, loading } = useCastingResponsesStore()

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
