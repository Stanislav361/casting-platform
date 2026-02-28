'use client'

import { Group, Skeleton } from '~packages/ui'

export default function Loading() {
	return (
		<Group>
			<Skeleton height={162} variant={'ellipsis'} />
			<Skeleton height={72} variant={'ellipsis'} />
			<Skeleton height={650} variant={'ellipsis'} />
		</Group>
	)
}
