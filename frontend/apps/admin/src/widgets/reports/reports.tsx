'use client'

import { useReportsStore } from '~widgets/reports/reports.hooks'

import { ReportList } from '~features/report'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

export const Reports = () => {
	const { count, list, loading } = useReportsStore()

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList />}
		>
			<ReportList reports={list} />
		</DataLoader>
	)
}
