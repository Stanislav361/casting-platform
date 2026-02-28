import { Platform } from '@telegram-apps/sdk-react'

export const PROFILE_IMAGES = 3

export const AUTH_PREFIX = 'tma'

export const MODE =
	process.env.MODE || process.env.NEXT_PUBLIC_MODE || 'development'

export const IS_PROD = MODE === 'production'

export const API_URL =
	process.env.API_URL ||
	process.env.NEXT_PUBLIC_API_URL ||
	'http://localhost:8000/'

export const TELEGRAM_CHANNEL =
	process.env.TELEGRAM_CHANNEL ||
	process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL ||
	'prostoprobuy_devv_channel'

export const NO_AVAILABLE_PLATFORMS: Platform[] = [
	'web',
	'weba',
	'tdesktop',
	'macos',
	'unknown',
]

export const UNIX_PLATFORMS: Platform[] = [
	'android',
	'android_x',
	'tdesktop',
	'web',
	'weba',
	'unknown',
]

export const APPLE_PLATFORMS: Platform[] = ['ios', 'macos']

export const ANDROID_PLATFORMS: Platform[] = ['android', 'android_x']

export const DESKTOP_PLATFORMS: Platform[] = [
	'unigram',
	'tdesktop',
	'web',
	'macos',
	'weba',
	'unknown',
]

export const INIT_DATA_RAW = ''
