'use client'

export const useInitDataRaw = (): string => {
	try {
		const { initDataRaw, useSignal } = require('@telegram-apps/sdk-react')
		return useSignal<string>(initDataRaw) || ''
	} catch {
		return ''
	}
}
