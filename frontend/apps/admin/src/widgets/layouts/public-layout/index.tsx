'use client'

import { PropsWithChildren } from 'react'

import PublicAside from '~widgets/public-aside'

import { Container, Spacing } from '~packages/ui'

import styles from './index.module.scss'

export const PublicLayout = ({ children }: PropsWithChildren) => {
	return (
		<div className={styles.layout}>
			<PublicAside />
			<div className={styles.layout__page}>
				<Container size={'lg'}>{children}</Container>
			</div>
		</div>
	)
}
