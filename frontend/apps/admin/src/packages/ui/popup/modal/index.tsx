import cn from 'classnames'
import { PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { ModalProps } from '@prostoprobuy/types'

import { ModalContext } from './index.context'
import styles from './index.module.scss'
import { ModalBody } from './modal-body'
import { ModalFooter } from './modal-footer'
import { ModalHeader } from './modal-header'

export const ModalComponent = ({
	open,
	onClose,
	children,
	minimal,
	...rest
}: ModalProps<PropsWithChildren>) => {
	const propagation = useMemoizedFn(e => {
		e.stopPropagation()
		onClose()
	})

	if (!open) return null

	return createPortal(
		<ModalContext value={{ onClose }}>
			<div
				role={'presentation'}
				className={styles.modal}
				onClick={propagation}
			>
				<div className={`${styles.modal__container}`}>
					<div
						role={'dialog'}
						onClick={e => e.stopPropagation()}
						className={cn(
							styles.modal__content,
							minimal && styles.modal__content__minimal,
						)}
						aria-modal={true}
						{...rest}
					>
						{children}
					</div>
				</div>
			</div>
		</ModalContext>,
		document.body,
	)
}

export const Modal = Object.assign(ModalComponent, {
	Header: ({ children }: PropsWithChildren) => (
		<ModalHeader>{children}</ModalHeader>
	),
	Body: ({ children }: PropsWithChildren) => (
		<ModalBody>{children}</ModalBody>
	),
	Footer: ({ children }: PropsWithChildren) => (
		<ModalFooter>{children}</ModalFooter>
	),
})
