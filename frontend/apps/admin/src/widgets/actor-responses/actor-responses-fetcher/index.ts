'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
	useActorResponsesStore,
} from '~widgets/actor-responses'

import { useActorResponses } from '~models/response'

import { WithActorID } from '@prostoprobuy/models'

export const ActorResponsesFetcher = ({ actor }: WithActorID) => {
	const { filter } = useActorResponsesStore()

	const { data, isLoading, isError } = useActorResponses(actor, {
		...filter,
		actor_id: actor,
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
