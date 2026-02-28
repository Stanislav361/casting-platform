'use client'

import {
	useLaunchParams as _useLaunchParams,
	type LaunchParams,
} from '@telegram-apps/sdk-react'

export const useLaunchParams = (): LaunchParams =>
	_useLaunchParams() as LaunchParams
