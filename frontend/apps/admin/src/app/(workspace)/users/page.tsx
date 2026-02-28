import { Metadata } from 'next'

import Users, { UsersFetcher, UsersFilter, UsersSearch } from '~widgets/users'

import { Group } from '~packages/ui'

export const metadata: Metadata = {
	title: 'Мои пользователи',
}

export default function UsersPage() {
	return (
		<Group>
			<UsersSearch />
			<UsersFilter />
			<Users />
			<UsersFetcher />
		</Group>
	)
}
