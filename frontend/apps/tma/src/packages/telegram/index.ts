'use client'

import {
	ANDROID_PLATFORMS,
	APPLE_PLATFORMS,
	DESKTOP_PLATFORMS,
	NO_AVAILABLE_PLATFORMS,
} from '~packages/system'

import { IS_CLIENT, IS_DEV } from '@prostoprobuy/system'

export class TelegramService {
	static get meta() {
		return { bot_inline: false, platform: 'web' as string, version: '8.0' }
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
