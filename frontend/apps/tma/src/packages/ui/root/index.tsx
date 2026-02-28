import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const Root = ({ children }: PropsWithChildren) => {
	return <div className={styles.root}>{children}</div>
}
