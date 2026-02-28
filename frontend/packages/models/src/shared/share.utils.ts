import { EnumType } from '@prostoprobuy/types'

import { ImageID } from './share.types'

export const toImageID = (id: number | string): ImageID => Number(id) as ImageID

export const PhysicalParameters = {
	age: 'age',
	height: 'height',
	clothing_size: 'clothing_size',
	shoe_size: 'shoe_size',
	bust_volume: 'bust_volume',
	hip_volume: 'hip_volume',
	waist_volume: 'waist_volume',
	look_type: 'look_type',
	hair_color: 'hair_color',
	hair_length: 'hair_length',
	experience: 'experience',
	qualification: 'qualification',
	gender: 'gender',
} as const

export type PhysicalParameters = EnumType<typeof PhysicalParameters>

export const PhysicalParametersMap: Record<PhysicalParameters, string> = {
	[PhysicalParameters.age]: 'Возраст',
	[PhysicalParameters.height]: 'Рост',
	[PhysicalParameters.clothing_size]: 'Размер одежды',
	[PhysicalParameters.shoe_size]: 'Размер обуви',
	[PhysicalParameters.bust_volume]: 'Объем груди',
	[PhysicalParameters.hip_volume]: 'Объем бедер',
	[PhysicalParameters.waist_volume]: 'Объем талии',
	[PhysicalParameters.look_type]: 'Тип внешности',
	[PhysicalParameters.hair_color]: 'Цвет волос',
	[PhysicalParameters.hair_length]: 'Длина волос',
	[PhysicalParameters.experience]: 'Опыт',
	[PhysicalParameters.qualification]: 'Квалификация',
	[PhysicalParameters.gender]: 'Пол',
} as const
