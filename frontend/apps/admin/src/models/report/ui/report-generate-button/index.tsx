import { IconClipboardText } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useGenerateReport } from '~models/report'

import { Action } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportGenerateButton = ({
	report,
	view = 'overlay',
	...rest
}: PropsWithAction<WithReportID>) => {
	const req = useGenerateReport(report)

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(undefined)
			toast.success('Отчет сгенерирован')
		})
	})

	return (
		<Action
			onClick={handleClick}
			{...rest}
			view={view}
			loading={req.isPending}
			icon={<IconClipboardText size={18} />}
		>
			Сгенерировать
		</Action>
	)
}
