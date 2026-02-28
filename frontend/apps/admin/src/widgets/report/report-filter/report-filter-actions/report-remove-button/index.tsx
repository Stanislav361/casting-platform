import { IconUserMinus } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useReportStore } from '~widgets/report'

import { useDeleteReportActors } from '~models/report'

import { DropdownAction } from '~packages/ui'

import { ActorID, WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportRemoveButton = ({ report }: WithReportID) => {
	const { checked } = useReportStore()
	const req = useDeleteReportActors(report)

	const handleUpdate = async () => {
		await tryAsync(async () => {
			await req.mutateAsync({
				actors_id: checked as ActorID[],
			})
			toast.success('Актеры удалены из отчета')
		})
	}

	return (
		<DropdownAction
			onClick={handleUpdate}
			disabled={req.isPending || checked.length === 0}
		>
			<IconUserMinus size={20} />
			Удалить выбранных
		</DropdownAction>
	)
}
