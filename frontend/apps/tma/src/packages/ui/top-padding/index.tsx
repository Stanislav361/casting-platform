'use client'

import { memo } from 'react'

import { TelegramService } from '~packages/telegram'

const style = {
	paddingTop: TelegramService.platformTopPadding,
}

export const TopPadding = memo(() => <div style={style}></div>)
