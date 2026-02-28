import { IconUserMinus } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useReportEditStore } from '~widgets/report-edit'

import { useDeleteReportActors } from '~models/report'

import { DropdownAction } from '~packages/ui'

import { ActorID, WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportEditRemoveButton = ({ report }: WithReportID) => {
	const { checked } = useReportEditStore()
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
			isDanger={true}
			disabled={req.isPending || checked.length === 0}
		>
			<IconUserMinus size={20} />
			Удалить выбранных
		</DropdownAction>
	)
}
