import { memo } from 'react'

import { Skeleton } from '~packages/ui'

interface ModelSkeletonListProps {
	count?: number
	height?: number
}

export const ModelSkeletonList = memo(
	({ count = 6, height = 226 }: ModelSkeletonListProps) => {
		return [...Array(count)].map((_, i) => (
			<Skeleton key={i} height={height} variant={'ellipsis'} />
		))
	},
)
