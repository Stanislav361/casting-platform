import {
	bindMiniAppCssVars,
	bindViewportCssVars,
	expandViewport,
	init as initSDK,
	mountBackButton,
	mountMiniAppSync,
	mountSwipeBehavior,
	mountViewport,
	requestFullscreen,
	restoreInitData,
	setDebug,
} from '@telegram-apps/sdk-react'

import { TelegramService } from '~packages/telegram'

export const init = (options: { debug: boolean; eruda: boolean }) => {
	try {
		setDebug(options.debug)
		initSDK()
	} catch {
		// SDK init failed — running outside Telegram (web browser).
		// Continue without TG SDK features.
		return
	}

	options.eruda &&
		void import('eruda').then(({ default: eruda }) => {
			eruda.init()
		})

	try {
		mountBackButton.ifAvailable()
		restoreInitData()

		if (mountMiniAppSync.isAvailable()) {
			mountMiniAppSync()
			bindMiniAppCssVars()
		}

		if (mountSwipeBehavior.isAvailable()) {
			mountSwipeBehavior()
		}

		if (mountViewport.isAvailable()) {
			mountViewport().then(() => {
				expandViewport()
				bindViewportCssVars()
				!TelegramService.isAvailable && requestFullscreen()
			})
		}
	} catch {
		// Non-critical: TG features unavailable in browser mode
	}
}
