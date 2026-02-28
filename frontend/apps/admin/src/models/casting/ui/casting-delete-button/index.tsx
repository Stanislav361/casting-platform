import { IconTrashFilled } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useDeleteCasting } from '~models/casting'

import { Action, Dialog } from '~packages/ui'

import { useMemoizedFn, useModal } from '@prostoprobuy/hooks'
import { WithCastingID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const CastingDeleteButton = ({
	casting,
	view = 'overlay',
	...rest
}: PropsWithAction<WithCastingID>) => {
	const { toggle, isOpen, close } = useModal()
	const req = useDeleteCasting()

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(casting)
			toast.success('Кастинг удален')
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
				applyLabel={'Удалить'}
			>
				Вы уверены, что хотите удалить кастинг? Отменить действие нельзя
			</Dialog>

			<Action
				onClick={toggle}
				{...rest}
				view={view}
				icon={<IconTrashFilled size={18} />}
			>
				Удалить
			</Action>
		</>
	)
}
