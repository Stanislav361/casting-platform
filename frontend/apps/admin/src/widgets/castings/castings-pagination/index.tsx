'use client'

import { setFilter, useCastingsStore } from '~widgets/castings'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const CastingsPagination = () => {
	const { filter, count, loading } = useCastingsStore()

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
