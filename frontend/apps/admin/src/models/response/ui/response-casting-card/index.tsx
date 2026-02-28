import { IconCalendarCheck, IconMail, IconPhone } from '@tabler/icons-react'
import Link from 'next/link'

import {
	ActorExperience,
	ActorSelfButton,
	ActorTags,
	ActorTelegramButton,
} from '~models/actor'
import { ResponseViewButton } from '~models/response'

import { CardModel, Chip, Flex, Tooltip } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { actorFullName, WithResponseCasting } from '@prostoprobuy/models'
import { formatDateInRu, formatYears } from '@prostoprobuy/toolkit'

import image from '~public/user-placeholder.png'

export const ResponseCastingCardActions = ({
	response,
}: WithResponseCasting) => {
	return (
		<>
			{response.video_intro && (
				<ActorSelfButton video_intro={response.video_intro} />
			)}
			<ResponseViewButton
				id={response.id}
				resource={'actors'}
				view={'brand-overlay'}
			/>
			<Tooltip label={'Написать в Telegram'}>
				<ActorTelegramButton
					telegram_url={response.telegram_url}
					view={'overlay'}
					onlyIcon={true}
				/>
			</Tooltip>
		</>
	)
}

export const ResponseCastingCard = ({ response }: WithResponseCasting) => {
	return (
		<CardModel
			data-response-id={response.id}
			image={response.image?.photo_url || image}
			imageAlt={actorFullName(response)}
			imageWidth={241}
			imageHeight={226}
			actions={<ResponseCastingCardActions response={response} />}
		>
			<Flex
				alignItems={'center'}
				gap={12}
				lineHeight={1}
				justifyContent='space-between'
			>
				<Link href={links.actors.byId(response.id)}>
					{actorFullName(response)}
				</Link>
			</Flex>
			<Flex alignItems={'center'} gap={8} flexWrap={'wrap'}>
				{response.city && (
					<Chip variant={'info'} size={'md'}>
						Город {response.city.name}
					</Chip>
				)}
				{response.age && (
					<Chip variant={'flat'} size={'md'}>
						Возраст {formatYears(response.age)}
					</Chip>
				)}
				<ActorExperience experience={response.experience} />
				{response.email && (
					<Chip variant={'default'} size={'md'}>
						<IconMail size={16} />
						{response.email}
					</Chip>
				)}
				{response.phone_number && (
					<Chip variant={'default'} size={'md'}>
						<IconPhone size={16} /> {response.phone_number}
					</Chip>
				)}
				{response.response_at && (
					<Chip variant={'default'} size={'md'}>
						<IconCalendarCheck size={16} />{' '}
						{formatDateInRu(response.response_at)}
					</Chip>
				)}
			</Flex>
			<ActorTags
				gender={response.gender}
				qualification={response.qualification}
				look_type={response.look_type}
				height={response.height}
				clothing_size={response.clothing_size}
				shoe_size={response.shoe_size}
			/>
		</CardModel>
	)
}
