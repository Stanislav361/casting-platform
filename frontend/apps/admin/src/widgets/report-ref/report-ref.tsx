'use client'

import { useReportRefStore } from '~widgets/report-ref/report-ref.hooks'

import { RefActorList } from '~features/report'
import { ModelSkeletonList } from '~features/shared'

import { useDeviceDetect } from '~packages/hooks'
import { DataLoader } from '~packages/lib'
import { Grid } from '~packages/ui'

import { WithReportPublicID } from '@prostoprobuy/models'

export const ReportRef = ({ report }: WithReportPublicID) => {
	const { isMobile } = useDeviceDetect()

	const { count, list, loading } = useReportRefStore()

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList height={522} count={10} />}
		>
			<Grid gap={24} gridTemplateColumns={!isMobile && '1fr 1fr 1fr 1fr'}>
				<RefActorList refs={list} report={report} />
			</Grid>
		</DataLoader>
	)
}
