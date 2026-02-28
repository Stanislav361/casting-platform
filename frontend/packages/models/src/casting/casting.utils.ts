import { CastingStatus } from './casting.enums'
import { CastingID } from './casting.types'

export const toCastingID = (id: number | string): CastingID =>
	Number(id) as CastingID

export const CastingStatusMap = {
	[CastingStatus.unpublished]: 'Не опубликован',
	[CastingStatus.published]: 'Опубликован',
	[CastingStatus.closed]: 'Завершен',
	[CastingStatus.not_closed]: 'Все активные',
}

export const CastingStatusActiveMap = {
	[CastingStatus.unpublished]: 'Не опубликован',
	[CastingStatus.published]: 'Опубликован',
	[CastingStatus.not_closed]: 'Все активные',
}

export const CASTING_SORT_BY_OPTIONS = [
	{
		label: 'По алфавиту',
		value: 'title',
	},
	{
		label: 'По дате создания',
		value: 'created_at',
	},
	{
		label: 'По дате публикации',
		value: 'published_at',
	},
]
