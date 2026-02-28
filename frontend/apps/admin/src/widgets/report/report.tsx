'use client'

import { useCallback } from 'react'

import { setChecked } from '~widgets/report/report.atom'
import { useReportStore } from '~widgets/report/report.hooks'

import { ReportActorList } from '~features/report'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

import { WithReportID } from '@prostoprobuy/models'

export const Report = ({ report }: WithReportID) => {
	const { count, list, loading, checked } = useReportStore()

	const checkHandler = useCallback(
		(id: number) => {
			setChecked(
				checked.includes(id)
					? checked.filter(item => item !== id)
					: [...checked, id],
			)
		},
		[checked],
	)

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList />}
		>
			<ReportActorList
				mode={'edit'}
				actors={list}
				checked={checked}
				onCheck={checkHandler}
				report={report}
			/>
		</DataLoader>
	)
}
