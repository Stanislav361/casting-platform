'use client'

import {
	Platform,
	retrieveLaunchParams,
	Version,
} from '@telegram-apps/sdk-react'

import {
	ANDROID_PLATFORMS,
	APPLE_PLATFORMS,
	DESKTOP_PLATFORMS,
	NO_AVAILABLE_PLATFORMS,
} from '~packages/system'

import { IS_CLIENT, IS_DEV } from '@prostoprobuy/system'

function safeLaunchParams() {
	try {
		return retrieveLaunchParams()
	} catch {
		return null
	}
}

export class TelegramService {
	static get meta(): {
		bot_inline: boolean
		platform: Platform
		version: Version
	} {
		const lp = safeLaunchParams()
		if (!lp) {
			return { bot_inline: false, platform: 'web' as Platform, version: '8.0' as Version }
		}
		return {
			bot_inline: lp.tgWebAppBotInline as boolean,
			platform: lp.tgWebAppPlatform as Platform,
			version: lp.tgWebAppVersion as Version,
		}
	}

	static get isAvailable() {
		return NO_AVAILABLE_PLATFORMS.includes(TelegramService.meta.platform)
	}

	static get isDesktopPlatform() {
		if (IS_DEV) return true
		return DESKTOP_PLATFORMS.includes(TelegramService.meta.platform)
	}

	static get isIos() {
		if (!IS_CLIENT) return false
		return TelegramService.meta.platform === 'ios'
	}

	static get isApplePlatform() {
		return APPLE_PLATFORMS.includes(TelegramService.meta.platform)
	}

	static get isAndroidPlatform() {
		if (IS_DEV) return false
		return ANDROID_PLATFORMS.includes(TelegramService.meta.platform)
	}

	static get platformTopPadding() {
		if (!IS_CLIENT) return 0
		if (TelegramService.isDesktopPlatform) return 0
		else return 100
	}
}
