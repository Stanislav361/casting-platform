import { IUser, UseUsers } from '@prostoprobuy/models'
import { createModelListApi } from '@prostoprobuy/toolkit'

export const {
	setCount,
	setList,
	setFilter,
	setLoading,
	setError,
	reset,
	changeQueryFromInput,
	$store: $users,
} = createModelListApi<IUser, UseUsers>({
	count: 0,
	list: [],
	error: false,
	loading: true,
	filter: {
		page_size: 30,
		page_number: 1,
		search: '',
	},
})
