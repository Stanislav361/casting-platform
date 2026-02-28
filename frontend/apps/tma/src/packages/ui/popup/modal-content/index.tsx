import { PropsWithChildren, ReactNode } from 'react'

import styles from './index.module.scss'

interface ModalContentProps extends PropsWithChildren {
	action?: ReactNode
}

export const ModalContent = ({ children, action }: ModalContentProps) => {
	return (
		<div className={styles.modalContent}>
			{children}
			{action && <div className={styles.modalButton}>{action}</div>}
		</div>
	)
}
