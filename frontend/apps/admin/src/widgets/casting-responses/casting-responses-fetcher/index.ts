'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
	useCastingResponsesStore,
} from '~widgets/casting-responses'

import { useCastingResponses } from '~models/response'

import { WithCastingID } from '@prostoprobuy/models'

export const CastingResponsesFetcher = ({ casting }: WithCastingID) => {
	const { filter } = useCastingResponsesStore()

	const { data, isLoading, isError } = useCastingResponses(casting, {
		...filter,
		casting_id: casting,
	})

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
