import { z } from 'zod'

import { ReadonlyCastingSchema } from '@prostoprobuy/models'

export const CastingSchema = ReadonlyCastingSchema.extend({
	has_applied: z.boolean(),
})
