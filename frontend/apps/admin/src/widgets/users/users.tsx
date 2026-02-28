'use client'

import { UsersPagination } from '~widgets/users/users-pagination'
import { useUsersStore } from '~widgets/users/users.hooks'

import { ModelSkeletonList } from '~features/shared'
import { useUserTableData } from '~features/user'

import { DataLoader } from '~packages/lib'
import { Card, Column, Table } from '~packages/ui'

const columns: Column[] = [
	{
		id: 'user',
		text: 'Пользователь',
		width: '50%',
	},
	{
		id: 'telegram_id',
		text: 'Телеграм ID',
		width: '30%',
	},
	{
		id: 'role',
		text: 'Роль',
		width: '60%',
	},
]

export const Users = () => {
	const { count, list, loading } = useUsersStore()

	const data = useUserTableData(list)

	return (
		<DataLoader
			isLoading={loading}
			countData={count}
			loadingFallback={<ModelSkeletonList />}
		>
			<Card padding={'md'} radius={'lg'}>
				<Table data={data} columns={columns} />
			</Card>
			<UsersPagination />
		</DataLoader>
	)
}
