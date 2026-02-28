export function format(date: Date, formatStr: string): string {
	const pad = (n: number, width = 2) => n.toString().padStart(width, '0')

	const replacements: Record<string, string> = {
		yyyy: date.getFullYear().toString(),
		MM: pad(date.getMonth() + 1),
		dd: pad(date.getDate()),
		HH: pad(date.getHours()),
		mm: pad(date.getMinutes()),
		ss: pad(date.getSeconds()),
	}

	try {
		return formatStr.replace(
			/yyyy|MM|dd|HH|mm|ss/g,
			match => replacements[match],
		)
	} catch (e) {
		return date.toString()
	}
}

export const formatDateInRu = (date: string): string => {
	try {
		return format(new Date(date), 'dd.MM.yyyy')
	} catch (e) {
		return date
	}
}

export const formatDateInRuFull = (date: string): string => {
	try {
		return format(new Date(date), 'dd.MM.yyyy HH:mm')
	} catch (e) {
		return date
	}
}

export const formatDateInUSA = (date: string): string => {
	try {
		return format(new Date(date), 'yyyy-MM-dd')
	} catch (e) {
		return date
	}
}
