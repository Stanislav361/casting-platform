import { EnumType } from '@prostoprobuy/types'

export const Formation = {
	widget: 'widget',
	'full-report': 'full-report',
} as const

export type Formation = EnumType<typeof Formation>
