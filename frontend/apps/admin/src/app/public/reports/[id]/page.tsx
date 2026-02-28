'use client'

import { use } from 'react'

import ReportRef, {
	ReportRefFetcher,
	ReportRefFilter,
	ReportRefPagination,
	ReportRefSearch,
} from '~widgets/report-ref'

import { useProducerReportStore } from '~models/report'

import { Group } from '~packages/ui'

import { toReportPublicID } from '@prostoprobuy/models'

import Loading from './loading'

export default function ReportRefPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = use(params)

	const { loading } = useProducerReportStore()

	return (
		<Group>
			{loading ? (
				<Loading />
			) : (
				<>
					<ReportRefSearch />
					<ReportRefFilter report={toReportPublicID(id)} />
					<ReportRef report={toReportPublicID(id)} />

					<ReportRefPagination />
				</>
			)}
			<ReportRefFetcher report={toReportPublicID(id)} />
		</Group>
	)
}
