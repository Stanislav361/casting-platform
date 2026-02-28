import Link from 'next/link'

import { ActorSelfButton } from '~models/actor'
import { CastingChip, CastingTags } from '~models/casting'
import { ResponseViewButton } from '~models/response'

import { CardModel, Flex } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { WithResponseActor } from '@prostoprobuy/models'

import image from '~public/view-placeholder.png'

export const ResponseActorCardActions = ({ response }: WithResponseActor) => {
	return (
		<>
			{response.video_intro && (
				<ActorSelfButton video_intro={response.video_intro} />
			)}
			<ResponseViewButton
				id={response.id}
				resource={'castings'}
				view={'brand-overlay'}
			/>
		</>
	)
}

export const ResponseActorCard = ({ response }: WithResponseActor) => {
	return (
		<CardModel
			data-response-id={response.id}
			image={response.image[0]?.photo_url || image}
			imageAlt={response.title}
			imageWidth={239}
			imageHeight={226}
			actions={<ResponseActorCardActions response={response} />}
		>
			<Flex alignItems={'center'} gap={12}>
				<Link href={links.castings.byId(response.id)}>
					{response.title}
				</Link>
				<CastingChip status={response.status} />
			</Flex>
			<CastingTags
				closed_at={response.closed_at}
				response_quantity={response.response_quantity}
				published_at={response.published_at}
				created_at={response.created_at}
				columnGap={23}
				rowGap={14}
			/>
		</CardModel>
	)
}
