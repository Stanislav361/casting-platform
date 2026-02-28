import { memo } from 'react'

import { ICasting } from '~models/casting'

import { Chip, ChipProps } from '~packages/ui'

import { CastingStatus, CastingStatusMap } from '@prostoprobuy/models'

const chipColor: Record<CastingStatus, ChipVariant> = {
	[CastingStatus.unpublished]: 'default',
	[CastingStatus.published]: 'primary',
	[CastingStatus.closed]: 'gray',
}

type CastingChipProps = Pick<ICasting, 'status'> & Pick<ChipProps, 'size'>

export const CastingChip = memo(({ status, size = 'sm' }: CastingChipProps) => (
	<Chip size={size} variant={chipColor[status]}>
		{CastingStatusMap[status]}
	</Chip>
))
