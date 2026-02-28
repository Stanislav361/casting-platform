import { IconMail, IconPhone } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { ActorExperience, ActorSelfButton } from '~models/actor'
import { useProducerReportActor } from '~models/report'
import { RefActorGallery } from '~models/report/ui/ref-actor-modal/ref-actor-gallery'

import { useDeviceDetect } from '~packages/hooks'
import { DataLoader } from '~packages/lib'
import {
	Card,
	Chip,
	Flex,
	Grid,
	Image,
	Line,
	Modal,
	Section,
	Skeleton,
	Spacing,
	Tag,
} from '~packages/ui'

import {
	actorFullName,
	IProducerReportActor,
	PhysicalParameters,
	PhysicalParametersMap,
	WithActorID,
} from '@prostoprobuy/models'
import {
	formatYears,
	HairColorMap,
	HairLengthMap,
	LookTypeMap,
} from '@prostoprobuy/toolkit'
import { ModalProps, Nullable } from '@prostoprobuy/types'

import styles from './index.module.scss'

const RefActorModalLoading = () => {
	const { isMobile } = useDeviceDetect()

	return (
		<Flex gap={24} flexDirection={isMobile ? 'column' : 'row'}>
			<Skeleton
				width={!isMobile && 449}
				height={647}
				variant={'rectangular'}
			/>
			<Skeleton
				width={!isMobile && 397}
				height={320}
				variant={'rectangular'}
			/>
		</Flex>
	)
}

export const RefActorModal = ({
	actor: actorId,
	open,
	onClose,
}: ModalProps<WithActorID>) => {
	const { isMobile } = useDeviceDetect()

	const [actor, setActor] = useState<Nullable<IProducerReportActor>>(null)
	const { isLoading, data } = useProducerReportActor(actorId)

	useEffect(() => {
		if (!isLoading && data) {
			setActor(data?.data)
		}
	}, [isLoading, data])

	return (
		<Modal open={open} onClose={onClose}>
			<Modal.Header>
				{isLoading ? 'Загрузка...' : actor && actorFullName(actor)}
			</Modal.Header>
			<Modal.Body>
				<Spacing />
				<DataLoader
					isLoading={isLoading}
					loadingFallback={<RefActorModalLoading />}
				>
					{actor && (
						<Flex
							gap={24}
							flexDirection={isMobile ? 'column' : 'row'}
						>
							{actor?.images[0]?.photo_url && (
								<div className={styles.refActorModalImage}>
									<RefActorGallery actor={actor} />
								</div>
							)}
							<Flex flexDirection={'column'} gap={20} flex={1}>
								<Section
									header={'Основная информация'}
									inline={true}
								>
									<Flex
										alignItems={'center'}
										gap={8}
										flexWrap={'wrap'}
									>
										{actor.city && (
											<Chip
												variant={'info'}
												size={'md'}
											>
												Город <b>{actor.city.name}</b>
											</Chip>
										)}
										{actor.age && (
											<Chip
												variant={'flat'}
												size={'md'}
											>
												Возраст <b>{formatYears(actor.age)}</b>
											</Chip>
										)}
										<ActorExperience
											weight={true}
											experience={actor.experience}
										/>
										{actor.email && (
											<Chip
												variant={'default'}
												size={'md'}
											>
												<IconMail size={16} />
												<b>{actor.email}</b>
											</Chip>
										)}
										{actor.phone_number && (
											<Chip
												variant={'default'}
												size={'md'}
												weight={'600'}
											>
												<IconPhone size={16} />{' '}
												<b>{actor.phone_number}</b>
											</Chip>
										)}
									</Flex>
								</Section>
								<Line />
								<Section header={'Параметры'} inline={true}>
									<Grid
										gap={10}
										gridTemplateColumns={'repeat(2, 1fr)'}
									>
										{actor.look_type && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.look_type
														]
													}
												>
													{
														LookTypeMap[
															actor.look_type
														]
													}
												</Tag>
											</Card>
										)}

										{actor.height && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.height
														]
													}
												>
													{actor.height} см.
												</Tag>
											</Card>
										)}

										{actor.clothing_size && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.clothing_size
														]
													}
												>
													{actor.clothing_size}
												</Tag>
											</Card>
										)}

										{actor.shoe_size && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.shoe_size
														]
													}
												>
													{actor.shoe_size}
												</Tag>
											</Card>
										)}

										{actor.hair_length && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.hair_length
														]
													}
												>
													{
														HairLengthMap[
															actor.hair_length
														]
													}
												</Tag>
											</Card>
										)}

										{actor.hair_color && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.hair_color
														]
													}
												>
													{
														HairColorMap[
															actor.hair_color
														]
													}
												</Tag>
											</Card>
										)}

										{actor.bust_volume && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.bust_volume
														]
													}
												>
													{actor.bust_volume}
												</Tag>
											</Card>
										)}

										{actor.waist_volume && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.waist_volume
														]
													}
												>
													{actor.waist_volume}
												</Tag>
											</Card>
										)}

										{actor.hip_volume && (
											<Card
												view={'filled'}
												padding={'md'}
											>
												<Tag
													label={
														PhysicalParametersMap[
															PhysicalParameters
																.hip_volume
														]
													}
												>
													{actor.hip_volume}
												</Tag>
											</Card>
										)}
									</Grid>
								</Section>
								<Line />
								{actor?.video_intro && (
									<ActorSelfButton
										width={'max'}
										video_intro={actor.video_intro}
									/>
								)}
							</Flex>
						</Flex>
					)}
				</DataLoader>
			</Modal.Body>
		</Modal>
	)
}
