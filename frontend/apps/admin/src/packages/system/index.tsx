export const TELEGRAM_AUTH_BOT =
	process.env.TELEGRAM_AUTH_BOT || process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT

export const TELEGRAM_AUTH_BOT_ID =
	process.env.TELEGRAM_AUTH_BOT_ID ||
	process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_ID

export const API_URL =
	process.env.API_URL ||
	process.env.NEXT_PUBLIC_API_URL ||
	'https://api.prostoprobuy-dev.ru/'

export const HOST =
	process.env.HOST || process.env.NEXT_PUBLIC_HOST || 'http://localhost:3001'
