import { EnumType } from '@prostoprobuy/types'

export const Roles = {
	administrator: 'administrator',
	producer: 'producer',
	agent: 'agent',
	user: 'user',
} as const

export type Roles = EnumType<typeof Roles>
