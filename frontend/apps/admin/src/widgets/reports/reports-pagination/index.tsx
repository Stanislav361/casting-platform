'use client'

import { setFilter, useReportsStore } from '~widgets/reports'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const ReportsPagination = () => {
	const { filter, count, loading } = useReportsStore()

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
