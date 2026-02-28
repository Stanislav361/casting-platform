import { IconTrashFilled } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useDeleteReport } from '~models/report'

import { Action, Dialog } from '~packages/ui'

import { useMemoizedFn, useModal } from '@prostoprobuy/hooks'
import { WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportDeleteButton = ({
	report,
	view = 'overlay',
	...rest
}: PropsWithAction<WithReportID>) => {
	const { toggle, isOpen, close } = useModal()
	const req = useDeleteReport()

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(report)
			toast.success('Отчет удален')
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
			>
				Вы уверены, что хотите удалить отчет? Отменить действие нельзя
			</Dialog>

			<Action
				{...rest}
				onClick={toggle}
				view={view}
				icon={<IconTrashFilled size={18} />}
			>
				Удалить
			</Action>
		</>
	)
}
