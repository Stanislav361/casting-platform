import Link from 'next/link'

import {
	CastingChip,
	CastingDeleteButton,
	CastingEditButton,
	CastingResponsesButton,
	CastingTags,
	CastingViewButton,
	WithListCasting,
} from '~models/casting'

import { CardModel, Flex, TextEllipsis, Tooltip } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { CastingStatus } from '@prostoprobuy/models'

import image from '~public/view-placeholder.png'

export const CastingCardActions = ({ casting }: WithListCasting) => {
	return (
		<>
			<CastingViewButton casting={casting.id} view={'brand'} />
			<CastingResponsesButton
				casting={casting.id}
				view={'brand-overlay'}
			/>
			{casting.status === CastingStatus.unpublished && (
				<Tooltip label={'Редактировать'}>
					<CastingEditButton
						casting={casting.id}
						view={'overlay'}
						onlyIcon={true}
					/>
				</Tooltip>
			)}
			{casting.status === CastingStatus.unpublished && (
				<Tooltip label={'Удалить'}>
					<CastingDeleteButton casting={casting.id} onlyIcon={true} />
				</Tooltip>
			)}
		</>
	)
}

export const CastingCard = ({ casting }: WithListCasting) => {
	return (
		<CardModel
			data-casting-id={casting.id}
			image={casting.image[0]?.photo_url || image}
			imageAlt={casting.title}
			imageWidth={239}
			imageHeight={226}
			actions={<CastingCardActions casting={casting} />}
		>
			<Flex alignItems={'center'} gap={12}>
				<Link href={links.castings.byId(casting.id)}>
					{casting.title}
				</Link>
				<CastingChip status={casting.status} />
			</Flex>
			<CastingTags
				closed_at={casting.closed_at}
				response_quantity={casting.response_quantity}
				published_at={casting.published_at}
				created_at={casting.created_at}
				columnGap={23}
				rowGap={14}
			/>
		</CardModel>
	)
}
