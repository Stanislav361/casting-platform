'use client'

import { useActorResponsesStore } from '~widgets/actor-responses/actor-responses.hooks'

import { ResponseActorList } from '~features/response'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

export const ActorResponses = () => {
	const { count, list, loading } = useActorResponsesStore()

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList />}
		>
			<ResponseActorList responses={list} />
		</DataLoader>
	)
}
