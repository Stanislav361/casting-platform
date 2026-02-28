'use client'

import { setFilter, useCastingResponsesStore } from '~widgets/casting-responses'

import { DebounceInput, Flex, FormCard, Select, Title } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { ACTOR_SORT_BY_OPTIONS } from '@prostoprobuy/models'
import { BASE_SORT_BY_OPTIONS } from '@prostoprobuy/system'

export const CastingResponsesSearch = () => {
	const { loading, filter } = useCastingResponsesStore()

	const changeHandler = useMemoizedFn(e =>
		setFilter({
			search: e,
		}),
	)

	const selectOrderHandler = useMemoizedFn((e: SelectEvent) =>
		setFilter({
			sort_order: e.target.value,
		}),
	)

	const selectByHandler = useMemoizedFn((e: SelectEvent) =>
		setFilter({
			sort_by: e.target.value,
		}),
	)

	return (
		<>
			<Title back={true}>Назад</Title>
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
						onChange={selectOrderHandler}
						options={BASE_SORT_BY_OPTIONS}
					/>
					<Select
						defaultValue={filter.sort_by}
						variant={'overlay'}
						radius={'md'}
						value={filter.sort_by}
						onChange={selectByHandler}
						options={ACTOR_SORT_BY_OPTIONS}
					/>
				</Flex>
			</FormCard>
		</>
	)
}
