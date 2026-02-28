import {
	IconCalendarMinus,
	IconCalendarPlus,
	IconShare,
	IconUserCheck,
} from '@tabler/icons-react'
import { CSSProperties } from 'react'

import { ICasting } from '~models/casting'

import { Grid, Tag } from '~packages/ui'

import { formatDateInRu, placeholder } from '@prostoprobuy/toolkit'

interface CastingTagsProps
	extends Pick<
		ICasting,
		'created_at' | 'closed_at' | 'published_at' | 'response_quantity'
	> {
	columnGap?: CSSProperties['columnGap']
	rowGap?: CSSProperties['rowGap']
}

export const CastingTags = ({
	closed_at,
	response_quantity,
	created_at,
	published_at,
	columnGap = 60,
	rowGap = 20,
}: CastingTagsProps) => {
	return (
		<Grid
			columnGap={columnGap}
			rowGap={rowGap}
			gridTemplateColumns={'repeat(2, 1fr)'}
			width={'fit-content'}
		>
			<Tag icon={<IconCalendarPlus />} label={'Дата создания'}>
				{formatDateInRu(created_at)}
			</Tag>
			<Tag
				icon={<IconCalendarMinus />}
				label={'Дата завершения'}
				color={!closed_at && '#16A34A'}
			>
				{placeholder(closed_at, 'Кастинг еще активен')}
			</Tag>
			<Tag icon={<IconShare />} label={'Дата публикации'}>
				{placeholder(published_at, 'Кастинг не опубликован')}
			</Tag>
			<Tag icon={<IconUserCheck />} label={'Откликнулось'}>
				{response_quantity} актёров
			</Tag>
		</Grid>
	)
}
