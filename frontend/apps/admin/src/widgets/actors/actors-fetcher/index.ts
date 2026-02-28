'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
	useActorsStore,
} from '~widgets/actors'

import { useActors } from '~models/actor'

export const ActorsFetcher = () => {
	const { filter } = useActorsStore()

	const { data, isLoading, isError } = useActors(filter)

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
