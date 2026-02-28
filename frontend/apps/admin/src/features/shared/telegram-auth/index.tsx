'use client'

import { IconBrandTelegram } from '@tabler/icons-react'
import useTelegramAuth from '@use-telegram-auth/hook'

import { TELEGRAM_AUTH_BOT_ID } from '~packages/system'

import { TelegramAuthData } from '@prostoprobuy/models'

import styles from './index.module.scss'

interface TelegramAuthProps {
	onLogin: (data: TelegramAuthData) => void
	onError: (error: any) => void;
}

export const TelegramAuth = ({ onLogin, onError }: TelegramAuthProps) => {
	const { onAuth } = useTelegramAuth(
		TELEGRAM_AUTH_BOT_ID,
		{
			windowFeatures: { popup: true },
		},
		{
			onSuccess: (result: TelegramAuthData) => onLogin(result),
			onError
		},
	)

	return (
		<div className={styles.telegramAuthButton} onClick={onAuth}>
			<IconBrandTelegram size={20} />
			Войти через телеграм
		</div>
	)
}
