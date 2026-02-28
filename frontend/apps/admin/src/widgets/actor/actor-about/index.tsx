import { IconMail, IconPhone } from '@tabler/icons-react'

import {
	Card,
	FixedGallery,
	Flex,
	Formatted,
	Grid,
	ImageView,
	Section,
	Tag,
} from '~packages/ui'

import {
	getOtherProfileImages,
	getProfileImage,
	PhysicalParameters,
	PhysicalParametersMap,
	WithActor,
} from '@prostoprobuy/models'
import {
	HairColorMap,
	HairLengthMap,
	ImageTypeMap,
	LookTypeMap,
	placeholder,
} from '@prostoprobuy/toolkit'
import { ImageType } from '@prostoprobuy/types'

export default function ActorAbout({ actor }: WithActor) {
	return (
		<>
			<Section header={'Контактная информация'}>
				<Flex flexDirection={'column'} gap={10}>
					<Card view={'filled'} padding={'md'}>
						<Flex alignItems={'center'} gap={6}>
							<IconMail size={18} />
							{actor.email}
						</Flex>
					</Card>
					<Card view={'filled'} padding={'md'}>
						<Flex alignItems={'center'} gap={6}>
							<IconPhone size={18} /> {actor.phone_number}
						</Flex>
					</Card>
				</Flex>
			</Section>
			<Section header={'Физические параметры'}>
				<Grid gap={10} gridTemplateColumns={'repeat(4, 1fr)'}>
					{actor.look_type && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.look_type
									]
								}
							>
								{LookTypeMap[actor.look_type]}
							</Tag>
						</Card>
					)}

					{actor.hair_color && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.hair_color
									]
								}
							>
								{HairColorMap[actor.hair_color]}
							</Tag>
						</Card>
					)}

					{actor.hair_length && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.hair_length
									]
								}
							>
								{HairLengthMap[actor.hair_length]}
							</Tag>
						</Card>
					)}

					{actor.height && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.height
									]
								}
							>
								{actor.height} см.
							</Tag>
						</Card>
					)}

					{actor.clothing_size && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.clothing_size
									]
								}
							>
								{actor.clothing_size}
							</Tag>
						</Card>
					)}

					{actor.shoe_size && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.shoe_size
									]
								}
							>
								{actor.shoe_size}
							</Tag>
						</Card>
					)}

					{actor.bust_volume && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.bust_volume
									]
								}
							>
								{actor.bust_volume}
							</Tag>
						</Card>
					)}

					{actor.waist_volume && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.waist_volume
									]
								}
							>
								{actor.waist_volume}
							</Tag>
						</Card>
					)}

					{actor.hip_volume && (
						<Card view={'filled'} padding={'md'}>
							<Tag
								label={
									PhysicalParametersMap[
										PhysicalParameters.hip_volume
									]
								}
							>
								{actor.hip_volume}
							</Tag>
						</Card>
					)}
				</Grid>
			</Section>
			<Section header={'О себе'}>
				<Formatted
					html={placeholder(actor.about_me, 'Нет данных', false)}
				/>
			</Section>

			{actor.images.length > 0 && (
				<Section header={'Фото'}>
					<Flex flexWrap={'wrap'} gap={20}>
						{getProfileImage(
							actor.images,
							ImageType.portrait,
							image => {
								return (
									image && (
										<ImageView
											src={image.photo_url}
											alt={''}
											tag={ImageTypeMap[image.image_type]}
											width={200}
											height={165}
										/>
									)
								)
							},
						)}

						{getProfileImage(
							actor.images,
							ImageType.side_profile,
							image => {
								return (
									image && (
										<ImageView
											src={image.photo_url}
											alt={''}
											tag={ImageTypeMap[image.image_type]}
											width={200}
											height={165}
										/>
									)
								)
							},
						)}

						{getProfileImage(
							actor.images,
							ImageType.full_body,
							image => {
								return (
									image && (
										<ImageView
											src={image.photo_url}
											alt={''}
											tag={ImageTypeMap[image.image_type]}
											width={200}
											height={165}
										/>
									)
								)
							},
						)}

						{getOtherProfileImages(actor.images).map(image => (
							<ImageView
								src={image.photo_url}
								alt={''}
								tag={ImageTypeMap[image.image_type]}
								width={200}
								height={165}
							/>
						))}
					</Flex>
				</Section>
			)}
		</>
	)
}
