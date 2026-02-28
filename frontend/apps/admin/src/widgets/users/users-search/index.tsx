'use client'

import {
	IconDotsVertical,
	IconSortDescendingSmallBig,
} from '@tabler/icons-react'

import { setFilter, useUsersStore } from '~widgets/users'

import { Button, DebounceInput, Flex, FormCard } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const UsersSearch = () => {
	const { loading, filter } = useUsersStore()

	const changeHandler = useMemoizedFn(value => {
		setFilter({
			search: value,
		})
	})

	return (
		<FormCard title={'Пользователи'}>
			<Flex alignItems={'center'} gap={16}>
				<DebounceInput
					onChange={changeHandler}
					value={filter.search}
					disabled={loading}
				/>
				<Button view={'overlay'} disabled={true}>
					<IconSortDescendingSmallBig size={20} />
				</Button>
				<Button view={'overlay'} disabled={true}>
					<IconDotsVertical size={20} />
				</Button>
			</Flex>
		</FormCard>
	)
}
