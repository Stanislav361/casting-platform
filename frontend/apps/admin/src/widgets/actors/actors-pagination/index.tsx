'use client'

import { setFilter, useActorsStore } from '~widgets/actors'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const ActorsPagination = () => {
	const { filter, count, loading } = useActorsStore()

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
