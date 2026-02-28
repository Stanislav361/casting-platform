import { ImageSchema } from '../shared'
import { z } from 'zod'

import { zBrand, zSchema } from '@prostoprobuy/toolkit'

export const zCastingId = zBrand(zSchema.id, 'CastingID')

const BaseCastingSchema = z.object({
	title: zSchema.title,
	description: zSchema.description,
})

export const CastingImageSchema = z.object({
	image: zSchema.image,
})

export const ReadonlyCastingSchema = BaseCastingSchema.extend({
	id: zCastingId,
	image: ImageSchema.array(),
})

export const WriteableCastingSchema = BaseCastingSchema.extend({
	image: zSchema.image.optional(),
})
