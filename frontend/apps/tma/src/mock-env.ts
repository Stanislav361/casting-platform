import {
	isTMA,
	mockTelegramEnv,
	retrieveLaunchParams,
	ThemeParams,
} from '@telegram-apps/sdk-react'

export async function mockEnv(): Promise<void> {
	if (isTMA()) return

	try {
		retrieveLaunchParams()
	} catch (e) {
		const initDataMocked = new URLSearchParams([
			[
				'user',
				JSON.stringify({
					id: 0,
					first_name: 'Dev',
					last_name: 'User',
					username: 'dev_user',
					language_code: 'ru',
					allows_write_to_pm: true,
				}),
			],
			['hash', '0000000000000000000000000000000000000000000000000000000000000000'],
			['auth_date', String(Math.floor(Date.now() / 1000))],
			['signature', ''],
		])

		const colors: ThemeParams = {
			accent_text_color: '#6ab2f2',
			bg_color: '#17212b',
			button_color: '#5288c1',
			button_text_color: '#ffffff',
			destructive_text_color: '#ec3942',
			header_bg_color: '#17212b',
			hint_color: '#708499',
			link_color: '#6ab3f3',
			secondary_bg_color: '#232e3c',
			section_bg_color: '#17212b',
			section_header_text_color: '#6ab3f3',
			subtitle_text_color: '#708499',
			text_color: '#f5f5f5',
		}

		const launchParams = {
			tgWebAppData: initDataMocked,
			tgWebAppBotInline: false,
			tgWebAppDefaultColors: colors,
			tgWebAppThemeParams: colors,
			tgWebAppFullscreen: false,
			tgWebAppShowSettings: false,
			tgWebAppStartParam: '',
			tgWebAppVersion: '8.4',
			tgWebAppPlatform: 'web',
		}

		mockTelegramEnv({
			launchParams,
		})
	}
}
