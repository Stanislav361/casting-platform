'use client'

import { use } from 'react'

import ReportRefFavorites, {
	ReportRefFavoritesFetcher,
	ReportRefFavoritesFilter,
	ReportRefFavoritesPagination,
	ReportRefFavoritesSearch,
} from '~widgets/report-ref-favorites'

import { useProducerReportStore } from '~models/report'

import { Group } from '~packages/ui'

import { toReportPublicID } from '@prostoprobuy/models'

import Loading from './loading'

export default function ReportRefFavoritesPage({
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
					<ReportRefFavoritesSearch report={toReportPublicID(id)} />
					<ReportRefFavoritesFilter />
					<ReportRefFavorites report={toReportPublicID(id)} />
					<ReportRefFavoritesPagination />
				</>
			)}
			<ReportRefFavoritesFetcher report={toReportPublicID(id)} />
		</Group>
	)
}
