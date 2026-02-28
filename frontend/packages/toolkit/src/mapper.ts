import {
	Gender,
	HairColor,
	HairLength,
	ImageType,
	LookType,
	Qualification,
} from '@prostoprobuy/types'

import { selectOptions } from './fn'

export const GenderMap: Record<Gender, string> = {
	[Gender.male]: 'Мужской',
	[Gender.female]: 'Женский',
}

export const genderOptions = selectOptions(GenderMap)

export const QualificationMap: Record<Qualification, string> = {
	[Qualification.professional]: 'Профессионал',
	[Qualification.skilled]: 'Опытный',
	[Qualification.enthusiast]: 'Любитель',
	[Qualification.beginner]: 'Новичок',
}

export const qualificationOptions = selectOptions(QualificationMap)

export const LookTypeMap: Record<LookType, string> = {
	[LookType.asian]: 'Азиатский ',
	[LookType.middle_eastern]: 'Арабский',
	[LookType.african]: 'Африканский',
	[LookType.jewish]: 'Еврейский',
	[LookType.european]: 'Европейский',
	[LookType.south_asian]: 'Индийский',
	[LookType.caucasian]: 'Кавказкий',
	[LookType.latino]: 'Латино',
	[LookType.mixed]: 'Метис',
	[LookType.biracial]: 'Мулат',
	[LookType.slavic]: 'Славянский',
	[LookType.other]: 'Другой',
}

export const lookTypeOptions = selectOptions(LookTypeMap)

export const HairColorMap: Record<HairColor, string> = {
	[HairColor.blonde]: 'Блондин',
	[HairColor.brunette]: 'Брюнет',
	[HairColor.brown]: 'Шатен',
	[HairColor.light_brown]: 'Русый',
	[HairColor.red]: 'Рыжий',
	[HairColor.gray]: 'Седой',
	[HairColor.other]: 'Другой',
}

export const hairColorOptions = selectOptions(HairColorMap)

export const HairLengthMap: Record<HairLength, string> = {
	[HairLength.short]: 'Короткие',
	[HairLength.medium]: 'Средние (до плеч)',
	[HairLength.long]: 'Длинные',
	[HairLength.bald]: 'Отсутствуют',
}

export const hairLengthOptions = selectOptions(HairLengthMap)

export const ImageTypeMap: Record<ImageType, string> = {
	[ImageType.portrait]: 'Портрет',
	[ImageType.side_profile]: 'Профиль',
	[ImageType.full_body]: 'Полный рост',
	[ImageType.other]: 'Доп. фото',
}

export const imageTypeOptions = selectOptions(ImageTypeMap)
