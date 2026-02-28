import { IconHanger, IconRuler2, IconShoe } from '@tabler/icons-react'
import Link from 'next/link'

import { RefActorFavoriteButton, RefActorModalButton } from '~models/report'

import { useDeviceDetect } from '~packages/hooks'
import { Card, CardImage, Chip, Flex, Tooltip } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import {
	actorFullName,
	PhysicalParametersMap,
	WithProducerReportListActor,
	WithReportPublicID,
} from '@prostoprobuy/models'
import { formatYears } from '@prostoprobuy/toolkit'

import image from '~public/user-placeholder.png'

import styles from './index.module.scss'

export const RefActorCard = ({
	actor,
	report,
}: WithProducerReportListActor & WithReportPublicID) => {
	const { isMobile } = useDeviceDetect()

	return (
		<Card
			radius={'lg'}
			fullWidth={true}
			padding={'sm'}
			className={styles.refActorCard}
		>
			<div className={styles.refActorFavorite}>
				<RefActorFavoriteButton
					favorite={actor.favorite}
					actor={actor.id}
					report={report}
				/>
			</div>
			<CardImage
				height={isMobile ? 214 : 358}
				width={isMobile ? 174 : 300}
				src={actor.image?.photo_url || image}
				alt={''}
				borderRadius={24}
			/>
			<Flex flexDirection={'column'} gap={6} lineHeight={1}>
				<h2>{actorFullName(actor)}</h2>
				<span className={styles.refActorCardSpan}>
					{formatYears(actor.age)} • {actor.city?.name}
				</span>
			</Flex>
			<Flex gap={12} flexWrap={'wrap'}>
				{actor.height && (
					<Tooltip label={PhysicalParametersMap['height']}>
						<Chip size={'md'}>
							<IconRuler2 size={16} /> {actor.height} см
						</Chip>
					</Tooltip>
				)}
				{actor.clothing_size && (
					<Tooltip label={PhysicalParametersMap['clothing_size']}>
						<Chip size={'md'}>
							<IconHanger size={16} /> {actor.clothing_size}
						</Chip>
					</Tooltip>
				)}
				{actor.shoe_size && (
					<Tooltip label={PhysicalParametersMap['shoe_size']}>
						<Chip size={'md'}>
							<IconShoe size={16} />
							{actor.shoe_size}
						</Chip>
					</Tooltip>
				)}
			</Flex>
			<RefActorModalButton actor={actor.id} />
		</Card>
	)
}
