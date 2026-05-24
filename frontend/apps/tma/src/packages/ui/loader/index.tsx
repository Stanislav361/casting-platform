import { Spinner } from '@telegram-apps/telegram-ui'
import Image from 'next/image'

import placeholder from '~public/people_placeholder.png'

import styles from './index.module.scss'

export const Loader = () => {
	return (
		<div className={styles.loader}>
			<div className={styles.loaderLogo}>
				prosto<span>probuy.pro</span>
			</div>
			<Image
				className={styles.loaderPlaceholder}
				src={placeholder}
				alt='placeholder'
				width={390}
				height={305}
			/>
			<div className={styles.loaderSpin}>
				<Spinner size={'l'} />
			</div>
		</div>
	)
}
