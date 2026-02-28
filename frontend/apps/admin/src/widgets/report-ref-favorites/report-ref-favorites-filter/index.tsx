'use client'

import {
	reset,
	setFilter,
	useReportRefFavoritesStore,
} from '~widgets/report-ref-favorites'

import {
	FilterDrawer,
	FilterDrawerApplied,
	filterDrawerSetter,
} from '~features/shared'

import { parseActorFilterFields, renderActorValueMap } from '~models/actor'
import { CitySelect } from '~models/city'

import { useDeviceDetect } from '~packages/hooks'
import { Card, Flex, FormFlex, FormRow, Input, Select } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import {
	CityFullName,
	PhysicalParameters,
	PhysicalParametersMap,
	UseProducerReportActors,
} from '@prostoprobuy/models'
import { DEFAULT_EXCLUDE_FIELDS } from '@prostoprobuy/system'
import {
	GenderMap,
	HairColorMap,
	HairLengthMap,
	LookTypeMap,
	selectOptionsWithBase,
} from '@prostoprobuy/toolkit'

export const ReportRefFavoritesFilter = () => {
	const { isMobile } = useDeviceDetect()

	const { filter } = useReportRefFavoritesStore()

	const handleFilter = useMemoizedFn(
		(e: any, field: keyof Partial<UseProducerReportActors>) => {
			setFilter({
				[field]: e.target.value,
			})
		},
	)

	const handleCity = useMemoizedFn((city: CityFullName) => {
		setFilter({
			city: city,
		})
	})

	return (
		<Card radius={'lg'} padding={'lg'}>
			<Flex alignItems={'center'} flexWrap={'wrap'} gap={14}>
				<Flex gap={16} flexWrap={'wrap'} width={isMobile && '100%'}>
					<FilterDrawer<UseProducerReportActors>
						view={'overlay'}
						inline={true}
						fields={filter}
						reset={reset}
						excludeFields={[...DEFAULT_EXCLUDE_FIELDS, 'favorite']}
						setter={setFilter}
						parseFields={parseActorFilterFields}
						renderValueMap={renderActorValueMap}
					>
						<FormRow label={'Город'}>
							<CitySelect
								selected={filter.city}
								onSelect={e => handleCity(e)}
							/>
						</FormRow>

						<FormRow
							label={
								PhysicalParametersMap[PhysicalParameters.gender]
							}
						>
							<Select
								width={'max'}
								options={selectOptionsWithBase(GenderMap)}
								radius={'md'}
								onChange={e => handleFilter(e, 'gender')}
								value={filter.gender}
							/>
						</FormRow>
						<FormRow
							label={
								PhysicalParametersMap[
									PhysicalParameters.look_type
								]
							}
						>
							<Select
								width={'max'}
								options={selectOptionsWithBase(LookTypeMap)}
								radius={'md'}
								onChange={e => handleFilter(e, 'look_type')}
								value={filter.look_type}
							/>
						</FormRow>
						<FormRow
							label={
								PhysicalParametersMap[
									PhysicalParameters.hair_color
								]
							}
						>
							<Select
								width={'max'}
								options={selectOptionsWithBase(HairColorMap)}
								radius={'md'}
								onChange={e => handleFilter(e, 'hair_color')}
								value={filter.hair_color}
							/>
						</FormRow>
						<FormRow
							label={
								PhysicalParametersMap[
									PhysicalParameters.hair_length
								]
							}
						>
							<Select
								width={'max'}
								options={selectOptionsWithBase(HairLengthMap)}
								radius={'md'}
								onChange={e => handleFilter(e, 'hair_length')}
								value={filter.hair_length}
							/>
						</FormRow>

						<FormRow>
							<strong>Диапазоны отбора</strong>
						</FormRow>

						<FormFlex>
							<FormRow label={parseActorFilterFields.min_age}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'min_age')}
									value={filter.min_age}
								/>
							</FormRow>
							<FormRow label={parseActorFilterFields.max_age}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'max_age')}
									value={filter.max_age}
								/>
							</FormRow>
						</FormFlex>

						<FormFlex>
							<FormRow
								label={parseActorFilterFields.min_experience}
							>
								<Input
									radius={'md'}
									onChange={e =>
										handleFilter(e, 'min_experience')
									}
									value={filter.min_experience}
								/>
							</FormRow>
							<FormRow
								label={parseActorFilterFields.max_experience}
							>
								<Input
									radius={'md'}
									onChange={e =>
										handleFilter(e, 'max_experience')
									}
									value={filter.max_experience}
								/>
							</FormRow>
						</FormFlex>

						<FormFlex>
							<FormRow label={parseActorFilterFields.min_height}>
								<Input
									radius={'md'}
									onChange={e =>
										handleFilter(e, 'min_height')
									}
									value={filter.min_height}
								/>
							</FormRow>
							<FormRow label={parseActorFilterFields.max_height}>
								<Input
									radius={'md'}
									onChange={e =>
										handleFilter(e, 'max_height')
									}
									value={filter.max_height}
								/>
							</FormRow>
						</FormFlex>

						<FormFlex>
							<FormRow label={parseActorFilterFields.min_cloth}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'min_cloth')}
									value={filter.min_cloth}
								/>
							</FormRow>
							<FormRow label={parseActorFilterFields.max_cloth}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'max_cloth')}
									value={filter.max_cloth}
								/>
							</FormRow>
						</FormFlex>

						<FormFlex>
							<FormRow label={parseActorFilterFields.min_shoe}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'min_shoe')}
									value={filter.min_shoe}
								/>
							</FormRow>
							<FormRow label={parseActorFilterFields.max_shoe}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'max_shoe')}
									value={filter.max_shoe}
								/>
							</FormRow>
						</FormFlex>

						<FormFlex>
							<FormRow label={parseActorFilterFields.min_bust}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'min_bust')}
									value={filter.min_bust}
								/>
							</FormRow>
							<FormRow label={parseActorFilterFields.max_bust}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'max_bust')}
									value={filter.max_bust}
								/>
							</FormRow>
						</FormFlex>

						<FormFlex>
							<FormRow label={parseActorFilterFields.min_waist}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'min_waist')}
									value={filter.min_waist}
								/>
							</FormRow>
							<FormRow label={parseActorFilterFields.max_waist}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'max_waist')}
									value={filter.max_waist}
								/>
							</FormRow>
						</FormFlex>

						<FormFlex>
							<FormRow label={parseActorFilterFields.min_hip}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'min_hip')}
									value={filter.min_hip}
								/>
							</FormRow>
							<FormRow label={parseActorFilterFields.max_hip}>
								<Input
									radius={'md'}
									onChange={e => handleFilter(e, 'max_hip')}
									value={filter.max_hip}
								/>
							</FormRow>
						</FormFlex>
					</FilterDrawer>
				</Flex>
				<FilterDrawerApplied<UseProducerReportActors>
					fields={filter}
					reset={reset}
					excludeFields={[...DEFAULT_EXCLUDE_FIELDS, 'favorite']}
					setter={setFilter}
					parseFields={parseActorFilterFields}
					renderValueMap={renderActorValueMap}
					onRemove={key => {
						filterDrawerSetter({
							setter: setFilter,
							key,
						})
					}}
				/>
			</Flex>
		</Card>
	)
}
