import { useDrawerContext } from '../index.context'
import { IconX } from '@tabler/icons-react'
import { PropsWithChildren, ReactNode } from 'react'

import styles from './index.module.scss'

export interface DrawerHeaderProps extends PropsWithChildren {
	action?: ReactNode
}

export const DrawerHeader = (props: DrawerHeaderProps) => {
	const { onClose } = useDrawerContext()

	return (
		<header className={styles.drawer__header}>
			<div className={styles.drawer__title}>
				<span onClick={onClose} className={styles.drawer__close}>
					<IconX size={26} />
				</span>
				<div className={styles.drawer__name}>{props.children}</div>
			</div>
			<div className={styles.drawer__actions}>{props?.action}</div>
		</header>
	)
}
