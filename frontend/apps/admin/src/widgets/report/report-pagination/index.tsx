'use client'

import { setFilter } from '~widgets/report/report.atom'
import { useReportStore } from '~widgets/report/report.hooks'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const ReportPagination = () => {
	const { filter, count, loading } = useReportStore()

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
