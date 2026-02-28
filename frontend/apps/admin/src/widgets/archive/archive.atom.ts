import { IListCasting } from '~models/casting'

import { CastingStatus, UseCastings } from '@prostoprobuy/models'
import { createModelListApi } from '@prostoprobuy/toolkit'

export const {
	setCount,
	setList,
	setFilter,
	setLoading,
	setError,
	reset,
	changeQueryFromInput,
	$store: $archive,
} = createModelListApi<IListCasting, UseCastings>({
	count: 0,
	list: [],
	error: false,
	loading: true,
	filter: {
		page_size: 25,
		page_number: 1,
		sort_by: 'created_at',
		sort_order: 'desc',
		search: '',
		min_published_at: '',
		max_published_at: '',
		status: CastingStatus.closed,
	},
})
