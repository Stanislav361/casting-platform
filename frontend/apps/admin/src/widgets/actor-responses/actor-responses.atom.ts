import { IResponseActor, UseResponsesActors } from '@prostoprobuy/models'
import { createModelListApi } from '@prostoprobuy/toolkit'

export const {
	setCount,
	setList,
	setFilter,
	setLoading,
	setError,
	reset,
	changeQueryFromInput,
	$store: $responses,
} = createModelListApi<IResponseActor, UseResponsesActors>({
	count: 0,
	list: [],
	error: false,
	loading: true,
	filter: {
		page_size: 25,
		page_number: 1,
		search: '',
		min_published_at: '',
		max_published_at: '',
		sort_by: 'created_at',
		sort_order: 'desc',
	},
})
