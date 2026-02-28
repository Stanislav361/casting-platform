import { PropsWithChildren } from 'react'

import { Button, Flex, Modal } from '~packages/ui'

import { ModalProps } from '@prostoprobuy/types'

interface DialogProps extends ModalProps<PropsWithChildren> {
	title?: string
	onApply?: () => void
	applyLabel?: string
	loading?: boolean
}

const style = {
	fontWeight: 500,
	fontSize: 15,
	color: 'var(--color-grey)',
}

export const Dialog = ({
	open,
	onClose,
	children,
	title = 'Подтверждение действия',
	onApply,
	applyLabel = 'Подтвердить',
	loading,
}: DialogProps) => {
	if (!open) return null

	return (
		<Modal open={open} onClose={onClose} minimal={true}>
			<Modal.Header>{title}</Modal.Header>
			<Modal.Body>
				<span style={style}>{children}</span>
			</Modal.Body>
			<Modal.Footer>
				<Flex alignItems={'center'} gap={16}>
					<Button
						view={'overlay'}
						width={'max'}
						onClick={onClose}
						loading={loading}
					>
						Отмена
					</Button>
					<Button
						view={'brand'}
						width={'max'}
						onClick={onApply}
						loading={loading}
					>
						{applyLabel}
					</Button>
				</Flex>
			</Modal.Footer>
		</Modal>
	)
}
