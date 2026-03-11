'use client'

import { memo } from 'react'

import { TelegramService } from '~packages/telegram'

export const TopPadding = memo(() => (
	<div style={{ paddingTop: TelegramService.platformTopPadding }} />
))
