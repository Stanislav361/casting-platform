import { z } from 'zod'

export const SessionSchema = z.object({
	access_token: z.string(),
})
