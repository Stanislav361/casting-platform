export function pluralizeYears(age: number): string {
	const m10 = age % 10
	const m100 = age % 100
	if (m10 === 1 && m100 !== 11) return 'год'
	if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'года'
	return 'лет'
}

export function getAgeParts(age?: number | string | null): { value: string; unit: string } | null {
	if (age == null || age === '') return null
	const value = typeof age === 'string' ? Number(age) : age
	if (!Number.isFinite(value) || value <= 0) return null
	const rounded = Math.floor(value)
	return {
		value: String(rounded),
		unit: pluralizeYears(rounded),
	}
}

export function formatAge(age?: number | string | null): string | null {
	const parts = getAgeParts(age)
	return parts ? `${parts.value} ${parts.unit}` : null
}

export function formatAgeRange(from?: number | string | null, to?: number | string | null): string | null {
	const fromValue = from == null || from === '' ? null : Number(from)
	const toValue = to == null || to === '' ? null : Number(to)
	const hasFrom = Number.isFinite(fromValue) && Number(fromValue) > 0
	const hasTo = Number.isFinite(toValue) && Number(toValue) > 0

	if (hasFrom && hasTo) {
		const start = Math.floor(Number(fromValue))
		const end = Math.floor(Number(toValue))
		if (start === end) return formatAge(end)
		return `${start}–${end} ${pluralizeYears(end)}`
	}
	if (hasFrom) return `от ${formatAge(fromValue)}`
	if (hasTo) return `до ${formatAge(toValue)}`
	return null
}

export function getAgeFromBirthDate(value?: string | null): number | null {
	if (!value) return null
	const birthDate = new Date(value)
	if (Number.isNaN(birthDate.getTime())) return null
	const now = new Date()
	let age = now.getFullYear() - birthDate.getFullYear()
	const monthDiff = now.getMonth() - birthDate.getMonth()
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1
	return age > 0 ? age : null
}
