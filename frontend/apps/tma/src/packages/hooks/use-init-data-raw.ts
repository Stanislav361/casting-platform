'use client'

import { initDataRaw, useSignal } from '@telegram-apps/sdk-react'

export const useInitDataRaw = (): string => {
	try {
		return useSignal<string>(initDataRaw) || ''
	} catch {
		return ''
	}
}
