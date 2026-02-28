'use client'

import { use } from 'react'

import ReportEdit, {
	ReportEditFetcher,
	ReportEditFilter,
	ReportEditPagination,
	ReportEditSearch,
} from '~widgets/report-edit'

import { useReportWidget } from '~models/report'

import { DataLoader } from '~packages/lib'
import { BackButton, Group } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { toReportID } from '@prostoprobuy/models'

import Loading from './loading'

export default function ReportPage({
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
			<BackButton href={links.reports.index} text={data?.data.title} />
			<Group>
				<ReportEditSearch report={data?.data} />
				<ReportEditFilter report={data?.data.id} />
				<ReportEdit report={data?.data.id} />
				<ReportEditPagination />
				<ReportEditFetcher report={data?.data.id} />
			</Group>
		</DataLoader>
	)
}
