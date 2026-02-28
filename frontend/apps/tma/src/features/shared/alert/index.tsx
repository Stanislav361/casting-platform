'use client'

import { Button } from '@telegram-apps/telegram-ui'
import Image from 'next/image'

import { TELEGRAM_CHANNEL } from '~packages/system'
import { Flex } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { openLink, telegramLink } from '@prostoprobuy/toolkit'

import styles from './index.module.scss'

interface AlertProps {
	title: string
	description: string
	image: ImageData
}

export default function Alert({ title, description, image }: AlertProps) {
	const handleClick = useMemoizedFn(() => {
		openLink(telegramLink(TELEGRAM_CHANNEL))
	})

	return (
		<div className={styles.alert}>
			<Image src={image} alt={''} height={400} width={400} />
			<Flex className={styles.alertContainer}>
				<div></div>
				<div className={styles.alertBlur}></div>
				<Flex gap={12} flexDirection={'column'}>
					<div className={styles.alertTitle}>{title}</div>
					<div className={styles.alertDesc}>{description}</div>
				</Flex>
				<div className={styles.alertCaption}>
					<Button size={'m'} onClick={handleClick}>
						Список кастингов
					</Button>
					Следите за активными кастингами в Telegram-канале
				</div>
			</Flex>
		</div>
	)
}
