import { CitySchema } from '../city'
import { ImageSchema, PhysicalParameterSchema } from '../shared'
import { z } from 'zod'

import { zBrand, zSchema } from '@prostoprobuy/toolkit'

export const zActorId = zBrand(zSchema.id, 'ActorID')

export const BaseActor = z
	.object({
		first_name: zSchema.name,
		last_name: zSchema.name,
		telegram_url: zSchema.url,
		about_me: zSchema.description.nullable(),
		email: zSchema.email,
		video_intro: zSchema.url,
		phone_number: zSchema.phone,
	})
	.extend(PhysicalParameterSchema.shape)

export const ReadonlyActorSchema = BaseActor.extend({
	id: zActorId,
	age: z.number(),
	city: CitySchema,
	images: ImageSchema.array(),
})

export const ReadonlyListActorSchema = ReadonlyActorSchema.omit({
	images: true,
	about_me: true,
}).extend({
	image: ImageSchema,
})

export const WritableActorSchema = BaseActor
