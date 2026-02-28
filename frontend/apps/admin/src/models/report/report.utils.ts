import { FilterDrawerKeyof, FilterDrawerMap } from '~features/shared'

import { CastingRepository } from '~models/casting'

import { UseReports } from '@prostoprobuy/models'

export const renderReportValueMap: FilterDrawerMap<UseReports> = {
	casting_id: async val => {
		const res = await CastingRepository.getById(val)

		if (res.status === 200) {
			return `${res.data.title}`
		} else {
			return `с id ${val}`
		}
	},
}

export const parseReportFilterFields: FilterDrawerKeyof<UseReports> = {
	casting_id: 'Кастинг',
	max_created_at: 'Дата создания до',
	min_created_at: 'Дата создания от',
}
