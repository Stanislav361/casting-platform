'use client'

import { setFilter, useArchiveStore } from '~widgets/archive'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const ArchivePagination = () => {
	const { filter, count, loading } = useArchiveStore()

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
