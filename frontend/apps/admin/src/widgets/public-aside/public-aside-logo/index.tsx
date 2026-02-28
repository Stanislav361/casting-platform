import Image from 'next/image'

import logo from '~public/logo_mini.png'

import styles from './index.module.scss'

export default function PublicAsideLogo() {
	return (
		<div className={styles.brand}>
			<Image
				src={logo}
				alt='actor-logo'
				width={44}
				height={44}
				unoptimized={true}
			/>
			<h1>prostoprobuy.pro</h1>
		</div>
	)
}
