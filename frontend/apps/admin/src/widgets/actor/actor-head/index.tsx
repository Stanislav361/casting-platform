import {
	IconCalendarEvent,
	IconFileCertificate,
	IconStar,
} from '@tabler/icons-react'

import { ActorSelfButton, ActorTelegramButton } from '~models/actor'

import { Card, CardImage, Chip, Flex, Title } from '~packages/ui'

import {
	actorFullName,
	actorProfileImage,
	WithActor,
} from '@prostoprobuy/models'
import { formatYears, QualificationMap } from '@prostoprobuy/toolkit'

import image from '~public/user-placeholder.png'

export default function ActorHead({ actor }: WithActor) {
	return (
		<Card fullWidth={true} padding={'lg'} radius={'lg'} view={'filled'}>
			<Flex justifyContent={'space-between'} alignItems={'center'}>
				<Flex alignItems={'center'} gap={14}>
					<CardImage
						src={actorProfileImage(actor) || image}
						width={102}
						height={97}
						alt={''}
					/>
					<Flex flexDirection={'column'} gap={12}>
						<Title>{actorFullName(actor)}</Title>
						<Flex alignItems={'center'} gap={12}>
							{actor.age && (
								<Chip variant={'tiny'} size={'s'}>
									<IconCalendarEvent size={18} />
									Возраст: {formatYears(actor.age)}
								</Chip>
							)}
							{actor.experience > 0 && (
								<Chip variant={'tiny'} size={'s'}>
									<IconStar size={18} />
									Опыт:{' '}
									{formatYears(actor.experience) || 'Нет'}
								</Chip>
							)}
							{actor.qualification && (
								<Chip variant={'tiny'} size={'s'}>
									<IconFileCertificate size={18} />
									Квалификация:{' '}
									{QualificationMap[actor.qualification]}
								</Chip>
							)}
						</Flex>
					</Flex>
				</Flex>
				<Flex flexDirection={'column'} gap={10}>
					<ActorTelegramButton
						telegram_url={actor.telegram_url}
						view={'brand'}
					/>
					{actor.video_intro && (
						<ActorSelfButton video_intro={actor.video_intro} />
					)}
				</Flex>
			</Flex>
		</Card>
	)
}
