import { IconWashDrycleanOff } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useDeleteReportFullActors } from '~models/report'

import { DropdownAction } from '~packages/ui'

import { WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportClearButton = ({ report }: WithReportID) => {
	const req = useDeleteReportFullActors(report)

	const handleUpdate = async () => {
		await tryAsync(async () => {
			await req.mutateAsync(null)
			toast.success('Отчет очищен')
		})
	}

	return (
		<DropdownAction
			onClick={handleUpdate}
			isDanger={true}
			disabled={req.isPending}
		>
			<IconWashDrycleanOff size={20} />
			Удалить всех
		</DropdownAction>
	)
}
