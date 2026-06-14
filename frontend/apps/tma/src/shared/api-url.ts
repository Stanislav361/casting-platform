const rawApiUrl =
	process.env.NEXT_PUBLIC_API_URL ||
	process.env.API_URL ||
	'http://localhost:8000/'

function withTrailingSlash(url: string) {
	return url.endsWith('/') ? url : `${url}/`
}

function inferBrowserApiUrl(raw: string) {
	if (typeof window === 'undefined') return withTrailingSlash(raw)

	const { hostname } = window.location
	const isLocalPage = ['localhost', '127.0.0.1'].includes(hostname)
	const isLocalApi = raw.includes('localhost') || raw.includes('127.0.0.1')

	if (!isLocalPage && isLocalApi) {
		if (hostname.endsWith('prostoprobuy-prod.ru')) return 'https://api.prostoprobuy-prod.ru/'
		if (hostname.endsWith('prostoprobuy-dev.ru')) return 'https://api.prostoprobuy-dev.ru/'
		return 'https://casting-platform-production.up.railway.app/'
	}

	if (window.location.protocol === 'https:' && raw.startsWith('http://') && !isLocalApi) {
		return withTrailingSlash(raw.replace(/^http:\/\//, 'https://'))
	}

	return withTrailingSlash(raw)
}

export const API_URL = inferBrowserApiUrl(rawApiUrl)
