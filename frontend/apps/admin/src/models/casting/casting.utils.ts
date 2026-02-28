import { FilterDrawerKeyof, FilterDrawerMap } from '~features/shared'

import {
	CastingStatus,
	CastingStatusMap,
	UseCastings,
} from '@prostoprobuy/models'
import { formatDateInRu } from '@prostoprobuy/toolkit'

export const renderCastingValueMap: FilterDrawerMap<UseCastings> = {
	status: (val: CastingStatus) => CastingStatusMap[val],
	min_published_at: (val: string) => val,
	max_published_at: (val: string) => val,
	max_created_at: (val: string) => val,
	min_created_at: (val: string) => val,
}

export const parseCastingFilterFields: FilterDrawerKeyof<UseCastings> = {
	status: 'Статус',
	min_published_at: 'Дата публикации от',
	max_published_at: 'Дата публикации до',
	max_created_at: 'Дата создания до',
	min_created_at: 'Дата создания от',
}
