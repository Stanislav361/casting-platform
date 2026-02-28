import Image from 'next/image'
import { PropsWithChildren, ReactNode } from 'react'

import bg from '~public/login.png'
import logo from '~public/logo.png'

import styles from './index.module.scss'

interface BodyCardProps extends PropsWithChildren {
	icon?: ReactNode
	title: string
	description: string
}

export const BodyCard = ({
	title,
	icon,
	description,
	children,
}: BodyCardProps) => {
	return (
		<div className={styles.loginWrapper}>
			<Image
				className={styles.loginLogo}
				src={logo}
				alt={''}
				width={91}
				height={61}
			/>
			<Image
				className={styles.loginBg}
				src={bg}
				alt={''}
				width={91}
				height={61}
			/>
			<div className={styles.loginContainer}>
				{icon}
				<div>
					<h1 className={styles.loginContainerTitle}>{title}</h1>
					<span className={styles.loginContainerSpan}>
						{description}
					</span>
				</div>
				{children}
			</div>
			<div></div>
		</div>
	)
}
