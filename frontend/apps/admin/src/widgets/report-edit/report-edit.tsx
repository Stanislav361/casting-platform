'use client'

import { useCallback } from 'react'

import { setChecked } from '~widgets/report-edit/report-edit.atom'
import { useReportEditStore } from '~widgets/report-edit/report-edit.hooks'

import { ReportActorList } from '~features/report'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

import { WithReportID } from '@prostoprobuy/models'

export const ReportEdit = ({ report }: WithReportID) => {
	const { count, list, loading, checked } = useReportEditStore()

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
				mode={'view'}
				actors={list}
				report={report}
				checked={checked}
				onCheck={checkHandler}
			/>
		</DataLoader>
	)
}
