import { IconX } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useCloseCasting } from '~models/casting'

import { Action, Dialog } from '~packages/ui'

import { useMemoizedFn, useModal } from '@prostoprobuy/hooks'
import { WithCastingID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const CastingCloseButton = ({
	casting,
	...rest
}: PropsWithAction<WithCastingID>) => {
	const { toggle, isOpen, close } = useModal()
	const req = useCloseCasting(casting)

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(undefined)
			toast.success('Кастинг завершён')
			close()
		})
	})

	return (
		<>
			<Dialog
				open={isOpen}
				onClose={close}
				loading={req.isPending}
				onApply={handleClick}
				applyLabel={'Завершить'}
			>
				Вы уверены, что хотите завершить кастинг? Отменить действие
				нельзя
			</Dialog>

			<Action onClick={toggle} {...rest} loading={req.isPending}>
				<IconX size={18} />
				Завершить
			</Action>
		</>
	)
}
