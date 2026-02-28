'use client'

import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

import { setFilter, useCastingsStore } from '~widgets/castings'

import { Button, DebounceInput, Flex, FormCard, Select } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { CASTING_SORT_BY_OPTIONS } from '@prostoprobuy/models'
import { BASE_SORT_BY_OPTIONS } from '@prostoprobuy/system'

export const CastingsSearch = () => {
	const { loading, filter } = useCastingsStore()
	const router = useRouter()

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
		<FormCard title={'Кастинги'}>
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
					options={CASTING_SORT_BY_OPTIONS}
				/>
				<Button
					view={'overlay'}
					onClick={() => router.push(links.castings.create)}
				>
					Объявить
					<IconPlus size={20} />
				</Button>
			</Flex>
		</FormCard>
	)
}
