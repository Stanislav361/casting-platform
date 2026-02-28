import { useMemo } from 'react'

import { FilterDrawerKeyof, FilterDrawerMap } from '~features/shared'

import {
	actorFullName,
	IActor,
	IProducerReportActor,
	PhysicalParameters,
	PhysicalParametersMap,
	UseActors,
} from '@prostoprobuy/models'
import {
	GenderMap,
	HairColorMap,
	HairLengthMap,
	ImageTypeMap,
	LookTypeMap,
} from '@prostoprobuy/toolkit'
import { ImageType } from '@prostoprobuy/types'

export const ActorImageTypeOrder = {
	[ImageType.portrait]: 1,
	[ImageType.side_profile]: 2,
	[ImageType.full_body]: 3,
	[ImageType.other]: 4,
}

export const useActorViewerGallery = (
	actor: IActor | IProducerReportActor,
	currentIndex: number,
) => {
	const images = useMemo(() => {
		return actor.images
			.slice()
			.sort(
				(a, b) =>
					ActorImageTypeOrder[a.image_type] -
					ActorImageTypeOrder[b.image_type],
			)
	}, [actor.images])

	const imagesUrls = useMemo(
		() => images.map(image => image.photo_url),
		[images],
	)

	const ActorViewerTitleComponent = useMemo(
		() => (
			<>
				<h2>{actorFullName(actor)}</h2>
				<span>
					Фотография актера (
					{ImageTypeMap[images[currentIndex].image_type]})
				</span>
			</>
		),
		[actor, currentIndex, images],
	)

	return {
		images,
		imagesUrls,
		ActorViewerTitleComponent,
	}
}

export type ActorValueMap = UseActors & { via_casting: string }

export const renderActorValueMap: FilterDrawerMap<ActorValueMap> = {
	gender: val => GenderMap[val],
	look_type: val => LookTypeMap[val],
	hair_color: val => HairColorMap[val],
	hair_length: val => HairLengthMap[val],
	via_casting: val => {
		if (val === 'true') return 'В кастинге'
		if (val === 'false') return 'Без кастинга'
	},
}

export const parseActorFilterFields: FilterDrawerKeyof<ActorValueMap> = {
	city: 'Город',
	via_casting: 'Актеры',
	gender: PhysicalParametersMap[PhysicalParameters.gender],
	qualification: PhysicalParametersMap[PhysicalParameters.qualification],
	look_type: PhysicalParametersMap[PhysicalParameters.look_type],
	hair_color: PhysicalParametersMap[PhysicalParameters.hair_color],
	hair_length: PhysicalParametersMap[PhysicalParameters.hair_length],
	min_age: `${PhysicalParametersMap[PhysicalParameters.age]}, от`,
	max_age: `${PhysicalParametersMap[PhysicalParameters.age]}, до`,
	min_experience: `${PhysicalParametersMap[PhysicalParameters.experience]}, от`,
	max_experience: `${PhysicalParametersMap[PhysicalParameters.experience]}, до`,
	min_height: `${PhysicalParametersMap[PhysicalParameters.height]}, от`,
	max_height: `${PhysicalParametersMap[PhysicalParameters.height]}, до`,
	min_cloth: `${PhysicalParametersMap[PhysicalParameters.clothing_size]}, от`,
	max_cloth: `${PhysicalParametersMap[PhysicalParameters.clothing_size]}, до`,
	min_shoe: `${PhysicalParametersMap[PhysicalParameters.shoe_size]}, от`,
	max_shoe: `${PhysicalParametersMap[PhysicalParameters.shoe_size]}, до`,
	min_bust: `${PhysicalParametersMap[PhysicalParameters.bust_volume]}, от`,
	max_bust: `${PhysicalParametersMap[PhysicalParameters.bust_volume]}, до`,
	min_waist: `${PhysicalParametersMap[PhysicalParameters.waist_volume]}, от`,
	max_waist: `${PhysicalParametersMap[PhysicalParameters.waist_volume]}, до`,
	min_hip: `${PhysicalParametersMap[PhysicalParameters.hip_volume]}, от`,
	max_hip: `${PhysicalParametersMap[PhysicalParameters.hip_volume]}, до`,
}
