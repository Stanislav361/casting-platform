'use client'

import { reset, setFilter, useUsersStore } from '~widgets/users'

import { FilterDrawer, FilterDrawerMap } from '~features/shared'

import { parseUserFilterFields } from '~models/user/user.utils'

import { Card, FormRow, Select } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { Roles, RolesMap, UseUsers } from '@prostoprobuy/models'
import { DEFAULT_EXCLUDE_FIELDS } from '@prostoprobuy/system'
import { selectOptionsWithBase } from '@prostoprobuy/toolkit'

const renderValueMap: FilterDrawerMap<UseUsers> = {
	role: (val: Roles) => RolesMap[val],
}

export const UsersFilter = () => {
	const { filter } = useUsersStore()

	const handleFilter = useMemoizedFn(
		(e: any, field: keyof Partial<UseUsers>) => {
			setFilter({
				[field]: e.target.value,
			})
		},
	)

	return (
		<Card radius={'lg'} padding={'lg'}>
			<FilterDrawer<UseUsers>
				view={'brand'}
				fields={filter}
				reset={reset}
				excludeFields={DEFAULT_EXCLUDE_FIELDS}
				setter={setFilter}
				parseFields={parseUserFilterFields}
				renderValueMap={renderValueMap}
			>
				<FormRow label={'Роль'}>
					<Select
						width={'max'}
						options={selectOptionsWithBase(RolesMap)}
						radius={'md'}
						onChange={e => handleFilter(e, 'role')}
						value={filter.role}
					/>
				</FormRow>
			</FilterDrawer>
		</Card>
	)
}
