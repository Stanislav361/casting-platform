import { z } from 'zod'

import { Branded, InjectProps, UseModelOptions } from '@prostoprobuy/types'

import { CastingStatus } from './casting.enums'
import { CastingImageSchema, WriteableCastingSchema } from './casting.schema'

export type CastingID = Branded<number, 'CastingID'>

export type ICreateCasting = z.infer<typeof WriteableCastingSchema>

export type IUpdateCasting = Partial<z.infer<typeof WriteableCastingSchema>>

export type ICastingImage = Partial<z.infer<typeof CastingImageSchema>>

export type WithCastingID = InjectProps<'casting', CastingID>

export type UseCastings = UseModelOptions<
	'title' | 'created_at' | 'published_at'
> & {
	status: CastingStatus
	exclude: CastingStatus
	min_published_at: string
	max_published_at: string
	min_created_at: string
	max_created_at: string
}
