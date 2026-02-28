import { useMemo } from 'react'

import { UserRolesButton } from '~features/user/user-roles-button'

import { UserCell } from '~models/user'

import { TableData } from '~packages/ui'

import { IUser } from '@prostoprobuy/models'

export const useUserTableData = (users: IUser[]): TableData[] =>
	useMemo(
		() =>
			users.map(user => ({
				user: <UserCell user={user} />,
				telegram_id: user.telegram_id,
				role: <UserRolesButton user={user} />,
			})),
		[users],
	)
