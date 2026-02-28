'use client'

import { use } from 'react'

import Report, {
	ReportFetcher,
	ReportFilter,
	ReportPagination,
	ReportSearch,
} from '~widgets/report'

import { useReportWidget } from '~models/report'

import { DataLoader } from '~packages/lib'
import { Group } from '~packages/ui'

import { toReportID } from '@prostoprobuy/models'

import Loading from './loading'

export default function ReportActorsPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = use(params)
	const { isLoading, isError, data } = useReportWidget(toReportID(id))

	return (
		<DataLoader
			isLoading={isLoading}
			hasError={isError}
			loadingFallback={<Loading />}
		>
			<Group>
				<ReportSearch report={data?.data} />
				<ReportFilter report={data?.data} />
				<Report report={data?.data.id} />
				<ReportPagination />
				<ReportFetcher report={data?.data.id} />
			</Group>
		</DataLoader>
	)
}
