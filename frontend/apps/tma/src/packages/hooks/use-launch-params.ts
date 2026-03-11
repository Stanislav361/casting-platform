'use client'

import {
	useLaunchParams as _useLaunchParams,
	type LaunchParams,
} from '@telegram-apps/sdk-react'

export const useLaunchParams = (): LaunchParams => {
	try {
		return _useLaunchParams() as LaunchParams
	} catch {
		return {} as LaunchParams
	}
}
