import { Title } from '@telegram-apps/telegram-ui'
import { memo } from 'react'

import { WithCasting } from '~models/casting'

import image from '~public/view-placeholder.png'

import styles from './index.module.scss'

export const CastingImage = memo(({ casting }: WithCasting) => {
	return (
		<div className={styles.castingImage}>
			<img
				src={casting?.image[0]?.photo_url || image}
				alt={''}
				height={320}
			/>
			<div className={styles.castingBlur}></div>
			<div className={styles.castingImageText}>
				<Title weight={'3'}>{casting?.title}</Title>
			</div>
		</div>
	)
})
