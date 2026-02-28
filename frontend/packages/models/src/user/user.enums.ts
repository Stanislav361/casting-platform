import { EnumType } from '@prostoprobuy/types'

export const Roles = {
	administrator: 'administrator',
	producer: 'producer',
	user: 'user',
} as const

export type Roles = EnumType<typeof Roles>
