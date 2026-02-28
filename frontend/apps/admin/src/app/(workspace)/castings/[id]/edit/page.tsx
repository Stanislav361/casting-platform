'use client'

import { use } from 'react'

import CastingEdit from '~widgets/casting-edit'

import { useCasting } from '~models/casting'

import { DataLoader } from '~packages/lib'

import { toCastingID } from '@prostoprobuy/models'

import Loading from './loading'

export default function CastingEditPage({
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
			<CastingEdit casting={data?.data} />
		</DataLoader>
	)
}
