import { PropsWithChildren } from 'react'

import Aside from '~widgets/aside'
import Nav from '~widgets/nav'

import { Container } from '~packages/ui'

import styles from './index.module.scss'

export const HomeLayout = ({ children }: PropsWithChildren) => {
	return (
		<div className={styles.layout}>
			<Aside />
			<div className={styles.layout__page}>
				<Nav />
				<Container size={'sm'}>{children}</Container>
			</div>
		</div>
	)
}
