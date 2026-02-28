import { z } from 'zod'

import { SessionSchema } from './auth.schema'

export type ISession = z.infer<typeof SessionSchema>

export interface TelegramAuthData {
	id: number
	first_name: string
	auth_date: number
	hash: string
	last_name?: string
	photo_url?: string
	username?: string
}
