'use client'

import type { InitData } from '@telegram-apps/sdk-react'

const GUEST_DATA: InitData = {
	user: {
		id: 0,
		first_name: 'Guest',
		last_name: '',
		username: 'guest',
		language_code: 'ru',
		is_premium: false,
		allows_write_to_pm: false,
		added_to_attachment_menu: false,
	},
	auth_date: new Date(),
	start_param: '',
	chat_type: 'sender',
	chat_instance: '',
	signature: '',
	hash: '',
}

export const useInitData = (): InitData => {
	try {
		const { initData, useSignal } = require('@telegram-apps/sdk-react')
		const data = useSignal(initData.state) as InitData | undefined
		return data || GUEST_DATA
	} catch {
		return GUEST_DATA
	}
}
