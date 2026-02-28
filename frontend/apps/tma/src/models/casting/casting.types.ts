import { z } from 'zod'

import { CastingSchema } from '~models/casting/casting.schema'

import { InjectProps, Nullable } from '@prostoprobuy/types'

export type ICasting = z.infer<typeof CastingSchema>

export type IListCasting = Omit<ICasting, 'description'>

export type WithCasting = InjectProps<'casting', ICasting>

export type WithListCasting = InjectProps<'casting', IListCasting>

export type CastingResponse = {
	video_intro: Nullable<string>
}
