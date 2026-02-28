import { Metadata } from 'next'
import { use } from 'react'

import CastingResponses, {
	CastingResponsesFetcher,
	CastingResponsesFilter,
	CastingResponsesPagination,
	CastingResponsesSearch,
} from '~widgets/casting-responses'

import { Group } from '~packages/ui'

import { toCastingID } from '@prostoprobuy/models'

export const metadata: Metadata = {
	title: 'Отклики',
}

export default function CastingResponsesPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = use(params)

	return (
		<Group>
			<CastingResponsesSearch />
			<CastingResponsesFilter />
			<CastingResponses />
			<CastingResponsesPagination />
			<CastingResponsesFetcher casting={toCastingID(id)} />
		</Group>
	)
}
