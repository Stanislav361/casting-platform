import { FC, PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const DrawerBody = ({ children }: PropsWithChildren) => {
	return <div className={styles.drawer__body}>{children}</div>
}
