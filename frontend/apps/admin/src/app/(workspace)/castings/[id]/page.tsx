'use client'

import { use } from 'react'

import Casting from '~widgets/casting'

import { useCasting } from '~models/casting'

import { DataLoader } from '~packages/lib'
import { BackButton } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { toCastingID } from '@prostoprobuy/models'

import Loading from './loading'

export default function CastingPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = use(params)
	const { isLoading, isError, data } = useCasting(toCastingID(id))

	return (
		<DataLoader
			isLoading={isLoading}
			hasError={isError}
			loadingFallback={<Loading />}
		>
			<BackButton href={links.castings.index} />
			<Casting casting={data?.data} />
		</DataLoader>
	)
}
