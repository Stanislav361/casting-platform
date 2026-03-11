import { placeholder } from '@prostoprobuy/toolkit'

import { Roles } from './user.enums'
import { IUser, TelegramID, TelegramUsername, UserID } from './user.types'

export const toUserID = (id: number | string): UserID => Number(id) as UserID

export const toTelegramID = (id: number | string): TelegramID =>
	Number(id) as TelegramID

export const toTelegramUsername = (id: number | string): TelegramUsername =>
	Number(id) as TelegramUsername

export const userFullName = (user: IUser) => {
	return `${placeholder(user?.first_name, '', false)} ${placeholder(user?.last_name, '', false)}`
}

export const userName = (user: IUser) => {
	return userFullName(user) || user?.telegram_username
}

export const RolesMap = {
	[Roles.administrator]: 'Администратор',
	[Roles.agent]: 'Агент',
	[Roles.user]: 'Пользователь',
}
