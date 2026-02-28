import cn from 'classnames'
import { PropsWithChildren, useMemo } from 'react'
import { createPortal } from 'react-dom'

import { DrawerBody } from './drawer-body'
import { DrawerHeader, DrawerHeaderProps } from './drawer-header'
import { DrawerContext } from './index.context'
import styles from './index.module.scss'

interface DrawerProps extends PropsWithChildren {
	isOpen: boolean
	onClose: () => void
	position?: 'left' | 'right' | 'top' | 'bottom'
	backdrop?: boolean
}

const DrawerComponent = ({
	isOpen,
	onClose,
	children,
	backdrop = true,
	position = 'right',
	...rest
}: DrawerProps) => {
	const isHorizontal = useMemo(
		() => position === 'left' || position === 'right',
		[position],
	)

	const positionClass = useMemo(
		() => styles[`drawer__content__${position}`],
		[position],
	)

	const orientationClass = useMemo(
		() =>
			isHorizontal
				? styles.drawer__content__horizontal
				: styles.drawer__content__vertical,
		[isHorizontal],
	)

	if (!isOpen) return null

	return createPortal(
		<DrawerContext value={{ onClose }}>
			<div
				role='presentation'
				className={cn(
					styles.drawer,
					backdrop && styles.drawer__backdrop,
				)}
				onClick={onClose}
			>
				<div
					role='dialog'
					aria-modal={true}
					onClick={e => e.stopPropagation()}
					className={cn(
						styles.drawer__content,
						positionClass,
						orientationClass,
					)}
					{...rest}
				>
					{children}
				</div>
			</div>
		</DrawerContext>,
		document.body,
	)
}

export const Drawer = Object.assign(DrawerComponent, {
	Header: ({ children, action }: DrawerHeaderProps) => (
		<DrawerHeader action={action}>{children}</DrawerHeader>
	),
	Body: ({ children }: PropsWithChildren) => (
		<DrawerBody>{children}</DrawerBody>
	),
})
