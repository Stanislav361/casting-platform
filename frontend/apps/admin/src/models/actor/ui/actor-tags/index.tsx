import { CSSProperties } from 'react'

import { Grid, Tag } from '~packages/ui'

import {
	IActor,
	PhysicalParameters,
	PhysicalParametersMap,
} from '@prostoprobuy/models'
import { GenderMap, LookTypeMap, QualificationMap } from '@prostoprobuy/toolkit'

interface ActorTagsProps
	extends Pick<
		IActor,
		| 'gender'
		| 'qualification'
		| 'look_type'
		| 'height'
		| 'clothing_size'
		| 'shoe_size'
	> {
	columnGap?: CSSProperties['columnGap']
	rowGap?: CSSProperties['rowGap']
}

export const ActorTags = ({
	gender,
	qualification,
	look_type,
	height,
	clothing_size,
	shoe_size,
	columnGap = 48,
	rowGap = 8,
}: ActorTagsProps) => {
	return (
		<Grid
			columnGap={columnGap}
			rowGap={rowGap}
			gridTemplateColumns={'repeat(2, 1fr)'}
			width={'fit-content'}
		>
			{gender && (
				<Tag
					label={PhysicalParametersMap[PhysicalParameters.gender]}
					flexDirection={'row'}
					gap={4}
				>
					{GenderMap[gender]}
				</Tag>
			)}

			{height && (
				<Tag
					label={PhysicalParametersMap[PhysicalParameters.height]}
					flexDirection={'row'}
					gap={4}
				>
					{height} см.
				</Tag>
			)}

			{qualification && (
				<Tag
					label={
						PhysicalParametersMap[PhysicalParameters.qualification]
					}
					flexDirection={'row'}
					gap={4}
				>
					{QualificationMap[qualification]}
				</Tag>
			)}

			{clothing_size && (
				<Tag
					label={
						PhysicalParametersMap[PhysicalParameters.clothing_size]
					}
					flexDirection={'row'}
					gap={4}
				>
					{clothing_size}
				</Tag>
			)}

			{look_type && (
				<Tag
					label={PhysicalParametersMap[PhysicalParameters.look_type]}
					flexDirection={'row'}
					gap={4}
				>
					{LookTypeMap[look_type]}
				</Tag>
			)}

			{shoe_size && (
				<Tag
					label={PhysicalParametersMap[PhysicalParameters.shoe_size]}
					flexDirection={'row'}
					gap={4}
				>
					{shoe_size}
				</Tag>
			)}
		</Grid>
	)
}
