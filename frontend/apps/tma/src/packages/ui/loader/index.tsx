import { Spinner } from '@telegram-apps/telegram-ui'
import Image from 'next/image'

import logo from '~public/logo-big.svg'
import placeholder from '~public/people_placeholder.png'

import styles from './index.module.scss'

export const Loader = () => {
	return (
		<div className={styles.loader}>
			<Image src={logo} alt='logo' width={266} height={64} />
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
