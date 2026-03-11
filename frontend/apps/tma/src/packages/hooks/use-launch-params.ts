'use client'

import type { LaunchParams } from '@telegram-apps/sdk-react'

export const useLaunchParams = (): LaunchParams => {
	try {
		const { useLaunchParams: _useLaunchParams } = require('@telegram-apps/sdk-react')
		return _useLaunchParams() as LaunchParams
	} catch {
		return {} as LaunchParams
	}
}
