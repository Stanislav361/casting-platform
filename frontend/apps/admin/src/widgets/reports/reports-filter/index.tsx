'use client'

import { reset, setFilter, useReportsStore } from '~widgets/reports'

import { FilterDrawer } from '~features/shared'

import { CastingSelect } from '~models/casting'
import { parseReportFilterFields, renderReportValueMap } from '~models/report'

import { Card, DateInput, FormFlex, FormRow } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { CastingID, toCastingID, UseReports } from '@prostoprobuy/models'
import { DEFAULT_EXCLUDE_FIELDS } from '@prostoprobuy/system'

export const ReportsFilter = () => {
	const { filter } = useReportsStore()

	const handleFilter = useMemoizedFn(
		(e: any, field: keyof Partial<UseReports>) => {
			setFilter({
				[field]: e.target.value,
			})
		},
	)

	const handleCasting = useMemoizedFn((casting: CastingID) => {
		setFilter({
			casting_id: casting,
		})
	})

	return (
		<Card radius={'lg'} padding={'lg'}>
			<FilterDrawer<UseReports>
				view={'brand'}
				fields={filter}
				reset={reset}
				excludeFields={DEFAULT_EXCLUDE_FIELDS}
				setter={setFilter}
				renderValueMap={renderReportValueMap}
				parseFields={parseReportFilterFields}
			>
				<FormRow label={'Кастинг'}>
					<CastingSelect
						selected={toCastingID(filter.casting_id)}
						onSelect={handleCasting}
					/>
				</FormRow>

				<FormFlex>
					<FormRow label={'Дата создания, от'}>
						<DateInput
							radius={'md'}
							onChange={e => handleFilter(e, 'min_created_at')}
							value={filter.min_created_at}
						/>
					</FormRow>

					<FormRow label={'Дата создания, до'}>
						<DateInput
							radius={'md'}
							onChange={e => handleFilter(e, 'max_created_at')}
							value={filter.max_created_at}
						/>
					</FormRow>
				</FormFlex>
			</FilterDrawer>
		</Card>
	)
}
