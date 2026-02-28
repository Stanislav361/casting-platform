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
	setDebug(options.debug)

	initSDK()

	options.eruda &&
		void import('eruda').then(({ default: eruda }) => {
			eruda.init()
		})

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

	console.log(
		`App is running on ${TelegramService.meta.platform} with version ${TelegramService.meta.version}`,
	)
}
