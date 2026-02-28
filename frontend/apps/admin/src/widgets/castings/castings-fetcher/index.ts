'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
	useCastingsStore,
} from '~widgets/castings'

import { useCastings } from '~models/casting'

import { CastingStatus } from '@prostoprobuy/models'

export const CastingsFetcher = () => {
	const { filter } = useCastingsStore()

	const { data, isLoading, isError } = useCastings(filter)

	useEffect(() => {
		setLoading(isLoading)
		setError(isError)
		if (!isLoading && data?.data) {
			setCount(data.data.meta.total_rows)
			setList(data.data.response)
		}
	}, [data, isLoading, isError])

	return null
}
