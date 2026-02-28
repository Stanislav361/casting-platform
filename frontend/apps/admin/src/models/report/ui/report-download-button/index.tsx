import { IconDownload } from '@tabler/icons-react'

import { Action } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { WithReport } from '@prostoprobuy/models'

export const ReportDownloadButton = ({
	report,
	view = 'overlay',
	...rest
}: PropsWithAction<WithReport>) => {
	const handleClick = useMemoizedFn(async () => {
		window.open(report.report_link)
	})

	return (
		<Action
			onClick={handleClick}
			{...rest}
			view={view}
			icon={<IconDownload size={18} />}
		>
			Скачать
		</Action>
	)
}
