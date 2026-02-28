'use client'

import { useSwipeable } from 'react-swipeable'
import type { SwipeableProps } from 'react-swipeable'

import { TelegramService } from '~packages/telegram'

export const useSafeSwipeable = (options: SwipeableProps) =>
	useSwipeable(TelegramService.isIos ? options : {})
