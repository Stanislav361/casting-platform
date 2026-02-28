import { IconTrash } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useDeleteReportActors } from '~models/report'

import { Action } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { WithActorID, WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportActorDeleteButton = ({
	actor,
	report,
	view = 'overlay',
	...rest
}: PropsWithAction<WithActorID & WithReportID>) => {
	const req = useDeleteReportActors(report)

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync({
				actors_id: [actor],
			})
			toast.success('Актер удален')
		})
	})

	return (
		<Action
			onClick={handleClick}
			{...rest}
			view={view}
			loading={req.isPending}
			icon={<IconTrash size={18} />}
		>
			Удалить
		</Action>
	)
}
