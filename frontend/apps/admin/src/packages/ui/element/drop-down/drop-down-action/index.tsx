import cn from 'classnames'
import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

interface DropdownActionProps extends PropsWithChildren {
	icon?: string
	isDanger?: boolean
	disabled?: boolean
	onClick?: (e?: any) => void
}

export const DropdownAction = (props: DropdownActionProps) => {
	return (
		<button
			disabled={props.disabled}
			className={cn(
				styles.overlay__action,
				props.isDanger && styles.overlay__action__danger,
			)}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	)
}
