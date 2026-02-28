'use client'

import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

import { setFilter, useReportsStore } from '~widgets/reports'

import { ReportCreateModal } from '~models/report'

import { Button, DebounceInput, Flex, FormCard, Select } from '~packages/ui'

import { useMemoizedFn, useModal } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import {
	ACTOR_SORT_BY_OPTIONS,
	REPORT_SORT_BY_OPTIONS,
} from '@prostoprobuy/models'
import { BASE_SORT_BY_OPTIONS } from '@prostoprobuy/system'

export const ReportsSearch = () => {
	const { loading, filter } = useReportsStore()
	const { open, isOpen, close } = useModal()

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
			{isOpen && <ReportCreateModal open={isOpen} onClose={close} />}

			<FormCard title={'Отчёты'}>
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
						options={REPORT_SORT_BY_OPTIONS}
					/>
					<Button view={'overlay'} onClick={open}>
						Добавить
						<IconPlus size={20} />
					</Button>
				</Flex>
			</FormCard>
		</>
	)
}
