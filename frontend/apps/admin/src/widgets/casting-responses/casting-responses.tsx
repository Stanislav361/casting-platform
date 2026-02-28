'use client'

import { useCastingResponsesStore } from '~widgets/casting-responses/casting-responses.hooks'

import { ResponseCastingList } from '~features/response'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

export const CastingResponses = () => {
	const { count, list, loading } = useCastingResponsesStore()

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList />}
		>
			<ResponseCastingList responses={list} />
		</DataLoader>
	)
}
