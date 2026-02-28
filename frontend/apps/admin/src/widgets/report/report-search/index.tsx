'use client'

import { setFilter } from '~widgets/report/report.atom'
import { useReportStore } from '~widgets/report/report.hooks'

import { ReportAction, ReportEditModal } from '~models/report'

import { DebounceInput, Flex, FormCard, Select } from '~packages/ui'

import { useMemoizedFn, useModal } from '@prostoprobuy/hooks'
import { ACTOR_SORT_BY_OPTIONS, WithReport } from '@prostoprobuy/models'
import { BASE_SORT_BY_OPTIONS } from '@prostoprobuy/system'

export const ReportSearch = ({ report }: WithReport) => {
	const { loading, filter } = useReportStore()

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
			{isOpen && (
				<ReportEditModal
					open={isOpen}
					onClose={close}
					report={report}
				/>
			)}

			<FormCard title={report.title} onEdit={open} justify={true}>
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
					<ReportAction report={report} view={'brand'} />
				</Flex>
			</FormCard>
		</>
	)
}
