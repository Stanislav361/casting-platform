'use client'

import { useCastingsStore } from '~widgets/castings/castings.hooks'

import { CastingList } from '~features/casting'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

export const Castings = () => {
	const { count, list, loading } = useCastingsStore()

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList />}
		>
			<CastingList castings={list} />
		</DataLoader>
	)
}
