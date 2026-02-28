import { IconMail, IconPhone } from '@tabler/icons-react'
import Link from 'next/link'

import {
	ActorExperience,
	ActorSelfButton,
	ActorTags,
	ActorTelegramButton,
	ActorViewButton,
} from '~models/actor'

import { CardModel, Chip, Flex, Tooltip } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { actorFullName, WithListActor } from '@prostoprobuy/models'
import { formatYears } from '@prostoprobuy/toolkit'

import image from '~public/user-placeholder.png'

export const ActorCardActions = ({ actor }: WithListActor) => {
	return (
		<>
			{actor.video_intro && (
				<ActorSelfButton video_intro={actor.video_intro} />
			)}
			<ActorViewButton actor={actor.id} view={'brand'} />
			<Tooltip label={'Написать в Telegram'}>
				<ActorTelegramButton
					telegram_url={actor.telegram_url}
					view={'overlay'}
					onlyIcon={true}
				/>
			</Tooltip>
		</>
	)
}

export const ActorCard = ({ actor }: WithListActor) => {
	return (
		<CardModel
			data-actor-id={actor.id}
			image={actor.image?.photo_url || image}
			imageAlt={actorFullName(actor)}
			imageWidth={241}
			imageHeight={226}
			actions={<ActorCardActions actor={actor} />}
		>
			<Flex alignItems={'center'} gap={12} lineHeight={1}>
				<Link href={links.actors.byId(actor.id)}>
					{actorFullName(actor)}
				</Link>
			</Flex>
			<Flex alignItems={'center'} gap={8} flexWrap={'wrap'}>
				{actor.city && (
					<Chip variant={'info'} size={'md'}>
						Город {actor.city.name}
					</Chip>
				)}
				{actor.age && (
					<Chip variant={'flat'} size={'md'}>
						Возраст {formatYears(actor.age)}
					</Chip>
				)}
				<ActorExperience experience={actor.experience} />
				{actor.email && (
					<Chip variant={'default'} size={'md'}>
						<IconMail size={16} />
						{actor.email}
					</Chip>
				)}
				{actor.phone_number && (
					<Chip variant={'default'} size={'md'}>
						<IconPhone size={16} /> {actor.phone_number}
					</Chip>
				)}
			</Flex>
			<ActorTags
				gender={actor.gender}
				qualification={actor.qualification}
				look_type={actor.look_type}
				height={actor.height}
				clothing_size={actor.clothing_size}
				shoe_size={actor.shoe_size}
			/>
		</CardModel>
	)
}
