import { createEvent, createStore } from 'effector'

import { ModelField } from '@prostoprobuy/types'

export const createFetcherModelApi = <T>(initialState: ModelField<T>) => {
	const setData = createEvent<T>()
	const setLoading = createEvent<boolean>()
	const setError = createEvent<boolean>()

	const $store = createStore<ModelField<T>>(initialState)

	$store.on(setData, (state, data) => ({ ...state, data }))
	$store.on(setLoading, (state, loading) => ({ ...state, loading }))
	$store.on(setError, (state, error) => ({ ...state, error }))

	return {
		setData,
		setLoading,
		setError,
		$store,
	}
}
