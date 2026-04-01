export const formatGenderLabel = (value?: string | null, variant: 'short' | 'full' = 'full') => {
	if (!value) return '—'
	const map: Record<string, { full: string; short: string }> = {
		male: { full: 'Мужчина', short: 'Муж' },
		female: { full: 'Женщина', short: 'Жен' },
	}
	return map[value]?.[variant] || value
}

export const formatQualificationLabel = (value?: string | null) => {
	if (!value) return '—'
	const map: Record<string, string> = {
		professional: 'Профессионал',
		skilled: 'Опытный',
		enthusiast: 'Энтузиаст',
		beginner: 'Начинающий',
		no_experience: 'Без опыта',
		amateur: 'Любитель',
		star: 'Звезда',
		other: 'Другое',
	}
	return map[value] || value
}

export const formatLookTypeLabel = (value?: string | null, variant: 'full' | 'feminine' = 'full') => {
	if (!value) return '—'
	const map: Record<string, { full: string; feminine: string }> = {
		european: { full: 'Европейский', feminine: 'Европейская' },
		asian: { full: 'Азиатский', feminine: 'Азиатская' },
		slavic: { full: 'Славянский', feminine: 'Славянская' },
		african: { full: 'Африканский', feminine: 'Африканская' },
		latino: { full: 'Латиноамериканский', feminine: 'Латиноамериканская' },
		latin: { full: 'Латиноамериканский', feminine: 'Латиноамериканская' },
		middle_eastern: { full: 'Ближневосточный', feminine: 'Ближневосточная' },
		caucasian: { full: 'Кавказский', feminine: 'Кавказская' },
		south_asian: { full: 'Южноазиатский', feminine: 'Южноазиатская' },
		mixed: { full: 'Смешанный', feminine: 'Смешанная' },
		other: { full: 'Другой', feminine: 'Другая' },
	}
	return map[value]?.[variant] || value
}

export const formatHairColorLabel = (value?: string | null) => {
	if (!value) return '—'
	const map: Record<string, string> = {
		blonde: 'Блонд',
		brunette: 'Брюнет',
		brown: 'Шатен',
		light_brown: 'Русый',
		black: 'Чёрный',
		red: 'Рыжий',
		gray: 'Седой',
		other: 'Другой',
	}
	return map[value] || value
}

export const formatHairLengthLabel = (value?: string | null) => {
	if (!value) return '—'
	const map: Record<string, string> = {
		short: 'Короткие',
		medium: 'Средние',
		long: 'Длинные',
		bald: 'Лысый',
	}
	return map[value] || value
}
