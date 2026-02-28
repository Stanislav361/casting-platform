import { IconTrash } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useClearReportActorFavorites } from '~models/report'

import { Action, Dialog } from '~packages/ui'

import { useMemoizedFn, useModal } from '@prostoprobuy/hooks'
import { WithReportPublicID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportClearFavoritesButton = ({
	report,
	trigger,
	view = 'danger',
	...rest
}: PropsWithAction<WithReportPublicID>) => {
	const { toggle, isOpen, close } = useModal()
	const req = useClearReportActorFavorites(report)

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(undefined)
			toast.success('Избранное очищено')
			toggle()
		})
	})

	return (
		<>
			<Dialog
				open={isOpen}
				onClose={close}
				loading={req.isPending}
				onApply={handleClick}
			>
				Вы уверены, что хотите удалить всех избранных отчета? Отменить
				действие нельзя
			</Dialog>

			<Action
				onClick={toggle}
				{...rest}
				view={view}
				icon={<IconTrash size={18} color={'white'} />}
			>
				Очистить избранное
			</Action>
		</>
	)
}
