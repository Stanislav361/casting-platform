import { useDeferredValue } from 'react'

import { ICasting } from '~models/casting'

import { DropdownItem } from '~packages/ui'

import { CastingID, CastingStatusMap } from '@prostoprobuy/models'
import { Nullable } from '@prostoprobuy/types'

import img from '~public/view-placeholder.png'

interface CastingSelectListProps {
	castings: ICasting[]
	selected: Nullable<CastingID>
	onSelect: (casting: CastingID) => void
}

export const CastingSelectList = ({
	castings,
	selected,
	onSelect,
}: CastingSelectListProps) => {
	const list: ICasting[] = useDeferredValue(castings, [])

	return list.map(casting => (
		<DropdownItem
			key={casting.id}
			img={casting.image[0]?.photo_url || img}
			description={CastingStatusMap[casting.status]}
			onClick={() => onSelect(casting.id)}
			active={casting.id === selected}
		>
			{casting.title}
		</DropdownItem>
	))
}
