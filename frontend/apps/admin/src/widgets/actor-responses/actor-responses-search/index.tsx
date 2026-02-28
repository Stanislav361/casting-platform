'use client'

import { useActorResponsesStore } from '~widgets/actor-responses'
import { setFilter } from '~widgets/casting-responses'

import { DebounceInput, Flex, FormCard, Select } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { BASE_SORT_BY_OPTIONS } from '@prostoprobuy/system'

export const ActorResponsesSearch = () => {
	const { loading, filter } = useActorResponsesStore()

	const changeHandler = useMemoizedFn(e =>
		setFilter({
			search: e,
		}),
	)

	const selectHandler = useMemoizedFn((e: SelectEvent) =>
		setFilter({
			sort_order: e.target.value,
		}),
	)

	return (
		<FormCard title={'Отклики'}>
			<Flex alignItems={'center'} gap={16}>
				<DebounceInput
					onChange={changeHandler}
					value={filter.search}
					disabled={loading}
				/>
				<Select
					defaultValue={filter.sort_order}
					variant={'overlay'}
					radius={'md'}
					value={filter.sort_order}
					onChange={selectHandler}
					options={BASE_SORT_BY_OPTIONS}
				/>
			</Flex>
		</FormCard>
	)
}
