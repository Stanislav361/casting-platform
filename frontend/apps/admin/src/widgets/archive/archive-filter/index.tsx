'use client'

import { reset, setFilter, useArchiveStore } from '~widgets/archive'

import { FilterDrawer } from '~features/shared'

import {
	parseCastingFilterFields,
	renderCastingValueMap,
} from '~models/casting'

import { Card, DateInput, FormFlex, FormRow } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { UseCastings } from '@prostoprobuy/models'
import { DEFAULT_EXCLUDE_FIELDS } from '@prostoprobuy/system'

export const ArchiveFilter = () => {
	const { filter } = useArchiveStore()

	const handleFilter = useMemoizedFn(
		(e: any, field: keyof Partial<UseCastings>) => {
			setFilter({
				[field]: e.target.value,
			})
		},
	)

	return (
		<Card radius={'lg'} padding={'lg'}>
			<FilterDrawer<UseCastings>
				view={'brand'}
				fields={filter}
				excludeFields={[...DEFAULT_EXCLUDE_FIELDS, 'status']}
				setter={setFilter}
				reset={reset}
				parseFields={parseCastingFilterFields}
				renderValueMap={renderCastingValueMap}
			>
				<FormFlex>
					<FormRow label={'Дата публикации, от'}>
						<DateInput
							radius={'md'}
							onChange={e => handleFilter(e, 'min_published_at')}
							value={filter.min_published_at}
						/>
					</FormRow>

					<FormRow label={'Дата публикации, до'}>
						<DateInput
							radius={'md'}
							onChange={e => handleFilter(e, 'max_published_at')}
							value={filter.max_published_at}
						/>
					</FormRow>
				</FormFlex>

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
