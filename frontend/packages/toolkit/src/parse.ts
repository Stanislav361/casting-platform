export type StartParamKey = 'casting'

export type StartParam = {
	key: StartParamKey
	value: number
}

export type StartParamParsed = StartParam[] | null

export const parseStartParam = (param: string): StartParam => {
	if (!param) return null
	const segments = param.split('_')
	if (segments.length % 2 !== 0) return null

	const allowedKeys: StartParamKey[] = ['casting']
	const result: StartParamParsed = []

	for (let i = 0; i < segments.length; i += 2) {
		const key = segments[i]
		const value = Number(segments[i + 1])
		if (!allowedKeys.includes(key as StartParamKey) || isNaN(value)) {
			return null
		}
		result.push({ key: key as StartParamKey, value })
	}

	return result[0]
}

export const renderMarkdown = (input: string): string => {
	let html = input

	html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
	html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
	html = html.replace(/~~(.*?)~~/g, '<s>$1</s>')
	html = html.replace(/__(.*?)__/g, '<u>$1</u>')
	html = html.replace(
		/\[(.*?)\]\((.*?)\)/g,
		`<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`,
	)

	return html
}

export function sanitizeBody(html: string): string {
	return html.replace(/<\/?(ul|ol|li)[^>]*>/gi, '')
}
