'use client'

import { useActorsStore } from '~widgets/actors/actors.hooks'

import { ActorList } from '~features/actor'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

export const Actors = () => {
	const { count, list, loading } = useActorsStore()

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList />}
		>
			<ActorList actors={list} />
		</DataLoader>
	)
}
