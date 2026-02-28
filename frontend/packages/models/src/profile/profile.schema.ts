import { CitySchema, zCityFullName } from '../city'
import {
	CoordinatePositionSchema,
	ImageSchema,
	PhysicalParameters,
	PhysicalParameterSchema,
} from '../shared'
import { z } from 'zod'

import { zBrand, zSchema } from '@prostoprobuy/toolkit'
import { ImageType } from '@prostoprobuy/types'

export const zProfileId = zBrand(zSchema.id, 'ProfileID')

const BaseProfile = z
	.object({
		first_name: zSchema.name,
		last_name: zSchema.name,
		telegram_url: zSchema.url,
		about_me: zSchema.optional(zSchema.about_me),
		date_of_birth: zSchema.dateAtLeastAge(1),
		email: zSchema.optional(zSchema.email),
		phone_number: zSchema.phone,
		video_intro: zSchema.optional(zSchema.url),
	})
	.extend(PhysicalParameterSchema.shape)

export const ReadonlyProfileImageSchema = ImageSchema.extend({
	coordinates: CoordinatePositionSchema,
})

export const WriteableProfileImageSchema = z.object({
	image: zSchema.image,
	image_type: z.nativeEnum(ImageType),
	x1: z.number(),
	y1: z.number(),
	x2: z.number(),
	y2: z.number(),
})

export const ReadonlyProfileSchema = BaseProfile.extend({
	id: zProfileId,
	city: CitySchema,
	images: ReadonlyProfileImageSchema.array(),
})

export const WriteableProfileSchema = BaseProfile.pick({
	first_name: true,
	last_name: true,
	date_of_birth: true,
	phone_number: true,
	email: true,
	about_me: true,
	video_intro: true,
	[PhysicalParameters.height]: true,
	[PhysicalParameters.clothing_size]: true,
	[PhysicalParameters.shoe_size]: true,
	[PhysicalParameters.bust_volume]: true,
	[PhysicalParameters.hip_volume]: true,
	[PhysicalParameters.waist_volume]: true,
	[PhysicalParameters.look_type]: true,
	[PhysicalParameters.hair_color]: true,
	[PhysicalParameters.hair_length]: true,
	[PhysicalParameters.experience]: true,
	[PhysicalParameters.qualification]: true,
	[PhysicalParameters.gender]: true,
}).extend({
	city: zCityFullName,
})
