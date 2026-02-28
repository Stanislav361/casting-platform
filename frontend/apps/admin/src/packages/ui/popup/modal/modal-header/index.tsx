import { useModalContext } from '../index.context'
import { IconX } from '@tabler/icons-react'
import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const ModalHeader = (props: PropsWithChildren) => {
	const { onClose } = useModalContext()

	return (
		<header className={styles.modal__header}>
			<div className={`${styles.modal__header__text}`}>
				{props.children}
			</div>
			<span className={styles.modal__header__close} onClick={onClose}>
				<IconX color={'var(--color-grey)'} size={26} />
			</span>
		</header>
	)
}
