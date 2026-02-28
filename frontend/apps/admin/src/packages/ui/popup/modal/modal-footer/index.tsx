import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const ModalFooter = ({ children }: PropsWithChildren) => (
	<footer className={styles.modalFooter}>{children}</footer>
)
