import { z } from 'zod'

import { zBrand, zSchema } from '@prostoprobuy/toolkit'

export const zCityId = zBrand(zSchema.id, 'CityID')

export const zCityFullName = zBrand(
	z.string({
		message: 'Город обязателен',
	}),
	'CityFullName',
)

export const CitySchema = z.object({
	name: z.string(),
	region: z.string(),
	full_name: zCityFullName,
})
