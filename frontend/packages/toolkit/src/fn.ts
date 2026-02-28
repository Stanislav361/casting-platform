import { SelectOption } from '@prostoprobuy/types'
import { formatDateInRu } from './date'
import { BASE_OPTION } from '@prostoprobuy/system'

export const calcPercent = (a: number, b: number) => {
	return Math.round((a * 100) / (b || 1))
}

export const nullable = (value: any) => value === undefined || value === null || value?.trim() === '' ? undefined : value

export const placeholder = (value?: string, placeholder = '-', isDate: boolean = true) => {
	return value !== undefined && value !== null && value.trim() !== '' ? isDate ? formatDateInRu(value) : value : placeholder
}

export const telegramLink = (telegramUsername: string): string => {
	return `https://t.me/${telegramUsername}`
}

export const openLink = (link: string, target?: string) => {
	window.open(link, target)
}

export const prepareRequestParams = <T extends Record<string, any>>(
	params?: T,
): T => {
	if (!params) return undefined

	return Object.fromEntries(
		Object.entries(params).map(([k, v]) => {
			if (v === null || v === undefined || String(v).trim() === '')
				return [k, undefined]
			return [k, v.toString()]
		}),
	) as T
}


export function isExperienceValidForAge(dateOfBirth: Date, experience: number, minWorkingAge = 3): boolean {
	const today = new Date()
	const birthDate = new Date(dateOfBirth)

	let age = today.getFullYear() - birthDate.getFullYear()
	const monthDiff = today.getMonth() - birthDate.getMonth()

	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
		age--
	}

	const maxExperience = Math.max(age - minWorkingAge, 0)

	return experience <= maxExperience
}

export const selectOptions = (
	object: Record<string, any>,
): SelectOption[] => {
	return Object.entries(object).map(([key, value]) => {
		return {
			label: value,
			value: key,
		}
	})
}

export const toUndefined = (val: unknown) =>
	val === '' ? null : val

export const selectOptionsWithBase = (object: Record<string, any>): SelectOption[] => {
	return [
		...BASE_OPTION,
		...selectOptions(object),
	]
}
export const isValidFileType = (file: File, types: string[]): boolean => {
	return types.includes(<string>file?.type)
}

export const isValidFileSize = (file: File, size_bytes: number): boolean => {
	return file.size <= size_bytes
}


export const stripTags = (inputString: string): string => {
	return inputString.replace(/<\/?[^>]+(>|$)/g, '')
}

export const mergeRefs = (...inputRefs) => {
	return ref => {
		inputRefs.forEach(inputRef => {
			if (!inputRef) {
				return
			}

			if (typeof inputRef === 'function') {
				inputRef(ref)
			} else {
				inputRef.current = ref
			}
		})
	}
}
