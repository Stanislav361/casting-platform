import { z } from 'zod'

import { zBrand, zSchema } from '@prostoprobuy/toolkit'

import { Roles } from './user.enums'

export const zUserId = zBrand(zSchema.id, 'UserID')

export const zTelegramId = zBrand(zSchema.id, 'TelegramID')

export const zTelegramUsername = zBrand(
	zSchema.telegramUsername,
	'TelegramUsername',
)

export const BaseUserSchema = z.object({
	first_name: zSchema.name,
	last_name: zSchema.name,
	photo_url: zSchema.url,
	telegram_id: zTelegramId,
	telegram_username: zTelegramUsername,
	role: z.nativeEnum(Roles),
})

export const ReadonlyUserSchema = BaseUserSchema.extend({
	id: zUserId,
})

export const WriteableUserSchema = BaseUserSchema.pick({
	role: true,
	telegram_username: true,
})

export const WriteableUserRoleSchema = BaseUserSchema.pick({
	role: true,
})
