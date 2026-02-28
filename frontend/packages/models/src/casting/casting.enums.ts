import { EnumType } from '@prostoprobuy/types'

export const CastingStatus = {
	unpublished: 'unpublished',
	published: 'published',
	closed: 'closed',
	not_closed: 'not_closed',
} as const

export type CastingStatus = EnumType<typeof CastingStatus>
