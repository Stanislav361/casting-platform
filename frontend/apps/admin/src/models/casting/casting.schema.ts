import { z } from 'zod'

import { CastingStatus, ReadonlyCastingSchema } from '@prostoprobuy/models'
import { zSchema } from '@prostoprobuy/toolkit'

export const CastingSchema = ReadonlyCastingSchema.extend({
	status: z.nativeEnum(CastingStatus),
	created_at: zSchema.datetime,
	published_at: zSchema.datetime,
	closed_at: zSchema.datetime,
	response_quantity: zSchema.indicator,
	post_url: zSchema.url,
})
