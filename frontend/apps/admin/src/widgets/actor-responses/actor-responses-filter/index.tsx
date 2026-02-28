'use client'

import {
	reset,
	setFilter,
	useActorResponsesStore,
} from '~widgets/actor-responses'

import { FilterDrawer } from '~features/shared'

import {
	parseCastingFilterFields,
	renderCastingValueMap,
} from '~models/casting'

import { Card, DateInput, FormFlex, FormRow, Select } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { CastingStatusMap, UseResponsesActors } from '@prostoprobuy/models'
import { DEFAULT_EXCLUDE_FIELDS } from '@prostoprobuy/system'
import { selectOptionsWithBase } from '@prostoprobuy/toolkit'

export const ActorResponsesFilter = () => {
	const { filter } = useActorResponsesStore()

	const handleFilter = useMemoizedFn(
		(e: any, field: keyof Partial<UseResponsesActors>) => {
			setFilter({
				[field]: e.target.value,
			})
		},
	)

	return (
		<Card radius={'lg'} padding={'lg'}>
			<FilterDrawer<UseResponsesActors>
				view={'brand'}
				fields={filter}
				reset={reset}
				excludeFields={[...DEFAULT_EXCLUDE_FIELDS, 'actor_id']}
				setter={setFilter}
				parseFields={parseCastingFilterFields}
				renderValueMap={renderCastingValueMap}
			>
				<FormRow label={'Статус'}>
					<Select
						options={selectOptionsWithBase(CastingStatusMap)}
						radius={'md'}
						onChange={e => handleFilter(e, 'status')}
						value={filter.status}
					/>
				</FormRow>

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
