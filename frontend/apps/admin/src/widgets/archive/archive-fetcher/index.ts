'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
	useArchiveStore,
} from '~widgets/archive'

import { useCastings } from '~models/casting'

export const ArchiveFetcher = () => {
	const { filter } = useArchiveStore()

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
