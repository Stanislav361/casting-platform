'use client'

import { ModelSkeletonList } from '~features/shared'

import { Group, Skeleton } from '~packages/ui'

export default function Loading() {
	return (
		<Group>
			<Skeleton height={137} variant={'ellipsis'} />
			<Skeleton height={86} variant={'ellipsis'} />
			<ModelSkeletonList />
		</Group>
	)
}
