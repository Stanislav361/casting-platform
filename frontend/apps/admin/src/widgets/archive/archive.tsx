'use client'

import { useArchiveStore } from '~widgets/archive/archive.hooks'

import { CastingList } from '~features/casting'
import { ModelSkeletonList } from '~features/shared'

import { DataLoader } from '~packages/lib'

export const Archive = () => {
	const { count, list, loading } = useArchiveStore()

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
