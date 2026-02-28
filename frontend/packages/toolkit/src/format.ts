export const formatEmptyParam = (text, sp = '') => {
	if (text) {
		return `${text} ${sp}`
	}
	return 'нет данных'
}

export const formatFileSize = (size: number): string => {
	if (size >= 1024 * 1024 * 1024) {
		return `${(size / (1024 * 1024 * 1024)).toFixed(2)} ГБ`
	} else if (size >= 1024 * 1024) {
		return `${(size / (1024 * 1024)).toFixed(2)} МБ`
	} else if (size >= 1024) {
		return `${(size / 1024).toFixed(2)} КБ`
	}
	return `${size} байт`
}

export const formatYears = (years: number | string): string => {
	if (years === null || years === undefined) {
		return ''
	}

	const numberYears = Number(years)

	const lastDigit = Number(numberYears) % 10

	if (numberYears % 100 >= 11 && numberYears % 100 <= 14) {
		return `${numberYears} лет`
	} else if (lastDigit === 1) {
		return `${numberYears} год`
	} else if (lastDigit >= 2 && lastDigit <= 4) {
		return `${numberYears} года`
	} else {
		return `${numberYears} лет`
	}
}

export function spaced(val: number): string {
	if (val < 10000) {
		return val.toString()
	}

	return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
