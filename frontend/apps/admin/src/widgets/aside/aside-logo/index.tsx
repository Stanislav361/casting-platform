import Image from 'next/image'
import Link from 'next/link'

import { links } from '@prostoprobuy/links'

import logo from '~public/logo_mini.png'

import styles from './index.module.scss'

export default function AsideLogo() {
	return (
		<Link href={links.actors.index} className={styles.brand}>
			<Image
				src={logo}
				alt='actor-logo'
				width={44}
				height={44}
				unoptimized={true}
			/>
			<h1>Панель управления</h1>
		</Link>
	)
}
