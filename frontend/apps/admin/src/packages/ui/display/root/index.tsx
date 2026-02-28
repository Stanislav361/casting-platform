import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const Root = ({ children }: PropsWithChildren) => (
	<main className={styles.root} role={'main'}>
		{children}
	</main>
)
