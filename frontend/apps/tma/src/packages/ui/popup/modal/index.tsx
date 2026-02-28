import { Modal as TgModal } from '@telegram-apps/telegram-ui'
import { ModalClose } from '@telegram-apps/telegram-ui/dist/components/Overlays/Modal/components/ModalClose/ModalClose'
import { ModalHeader } from '@telegram-apps/telegram-ui/dist/components/Overlays/Modal/components/ModalHeader/ModalHeader'
import { Icon28Close } from '@telegram-apps/telegram-ui/dist/icons/28/close'
import { PropsWithChildren, ReactNode } from 'react'

import styles from './index.module.scss'

interface ModalProps extends PropsWithChildren {
	modalTitle?: ReactNode
	isOpen?: boolean
	toggle?: () => void
}

export const Modal = ({ modalTitle, children, isOpen, toggle }: ModalProps) => {
	return (
		<TgModal
			preventScrollRestoration={true}
			dismissible={false}
			modal={true}
			open={isOpen}
			style={{
				background: 'var(--tgui--secondary_bg_color)',
				zIndex: 100,
			}}
			header={
				<ModalHeader
					className={styles.modalHeader}
					style={{
						background: 'var(--tgui--secondary_bg_color)',
						borderRadius: '16px 16px 0 0',
					}}
					after={
						<ModalClose>
							<Icon28Close
								onClick={toggle}
								style={{
									color: 'var(--tgui--plain_foreground)',
								}}
							/>
						</ModalClose>
					}
				>
					{modalTitle}
				</ModalHeader>
			}
		>
			{children}
		</TgModal>
	)
}
