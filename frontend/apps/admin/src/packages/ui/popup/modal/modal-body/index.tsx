import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const ModalBody = ({ children }: PropsWithChildren) => (
	<div className={styles.modalBody}>{children}</div>
)
