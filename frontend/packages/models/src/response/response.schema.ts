import { BaseActor } from '../actor'
import { CastingStatus, ReadonlyCastingSchema } from '../casting'
import { CitySchema } from '../city'
import { ImageSchema } from '../shared'
import { z } from 'zod'

import { zBrand, zSchema } from '@prostoprobuy/toolkit'

export const zResponseActorId = zBrand(zSchema.id, 'ResponseActorID')

export const zResponseCastingId = zBrand(zSchema.id, 'ResponseCastingID')

export const ReadonlyResponseActorSchema = BaseActor.omit({
	about_me: true,
}).extend({
	id: zResponseActorId,
	age: z.number(),
	image: ImageSchema,
	city: CitySchema,
	response_at: zSchema.datetime,
})

export const ReadonlyResponseCastingSchema = ReadonlyCastingSchema.extend({
	id: zResponseCastingId,
	video_intro: zSchema.url,
	status: z.nativeEnum(CastingStatus),
	created_at: zSchema.datetime,
	published_at: zSchema.datetime,
	closed_at: zSchema.datetime,
	response_quantity: zSchema.indicator,
})
