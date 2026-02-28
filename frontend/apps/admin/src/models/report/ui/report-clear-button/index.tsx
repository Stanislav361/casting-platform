import toast from 'react-hot-toast'

import { useDeleteReportFullActors } from '~models/report'

import { Action } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const ReportClearButton = ({
	report,
	trigger,
	view = 'overlay',
	...rest
}: PropsWithAction<WithReportID>) => {
	const req = useDeleteReportFullActors(report)

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(undefined)
			toast.success('Отчет очищен')
		})
	})

	return (
		<>
			<Action
				loading={req.isPending}
				onClick={handleClick}
				{...rest}
				view={view}
			>
				Очистить отчет
			</Action>
		</>
	)
}
