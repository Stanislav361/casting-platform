import { IReport, UseReports } from '@prostoprobuy/models'
import { createModelListApi } from '@prostoprobuy/toolkit'

export const {
	setCount,
	setList,
	setFilter,
	setLoading,
	setError,
	reset,
	changeQueryFromInput,
	$store: $reports,
} = createModelListApi<IReport, UseReports>({
	count: 0,
	list: [],
	error: false,
	loading: true,
	filter: {
		page_size: 25,
		page_number: 1,
		min_created_at: '',
		max_created_at: '',
		sort_order: 'desc',
		sort_by: 'created_at',
		search: '',
	},
})
