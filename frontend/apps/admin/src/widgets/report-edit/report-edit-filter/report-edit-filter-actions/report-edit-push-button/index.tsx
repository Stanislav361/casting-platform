import { IconUserCheck } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useReportEditStore } from '~widgets/report-edit'

import { useUpdateReportActors } from '~models/report'

import { DropdownAction } from '~packages/ui'

import { ActorID, WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportEditPushButton = ({ report }: WithReportID) => {
	const { checked } = useReportEditStore()
	const req = useUpdateReportActors(report)

	const handleUpdate = async () => {
		await tryAsync(async () => {
			await req.mutateAsync({
				actors_id: checked as ActorID[],
			})
			toast.success('Актеры добавлены в отчет')
		})
	}

	return (
		<DropdownAction
			onClick={handleUpdate}
			disabled={req.isPending || checked.length === 0}
		>
			<IconUserCheck size={20} />
			Добавить выбранных
		</DropdownAction>
	)
}
