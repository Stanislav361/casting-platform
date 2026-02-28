import { z } from 'zod'

import { Branded, InjectProps, UseModelOptions } from '@prostoprobuy/types'

import { Roles } from './user.enums'
import {
	BaseUserSchema,
	ReadonlyUserSchema,
	WriteableUserRoleSchema,
	WriteableUserSchema,
} from './user.schema'

export type UserID = Branded<number, 'UserID'>

export type TelegramID = Branded<number, 'TelegramID'>

export type TelegramUsername = Branded<number, 'TelegramUsername'>

export type IUser = z.infer<typeof ReadonlyUserSchema>

export type ICreateUser = z.infer<typeof WriteableUserSchema>

export type IUpdateUser = Partial<z.infer<typeof WriteableUserSchema>>

export type IUpdateUserRole = z.infer<typeof WriteableUserRoleSchema>

export type WithUserID = InjectProps<'user', UserID>

export type WithUser = InjectProps<'user', IUser>

export type UseUsers = UseModelOptions & {
	role: Roles
	is_active: boolean
}
