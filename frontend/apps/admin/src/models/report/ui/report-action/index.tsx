'use client'

import { IconLink } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { HOST } from '~packages/system'
import { Action } from '~packages/ui'

import { useCopy, useMemoizedFn } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { WithReport } from '@prostoprobuy/models'

export const ReportAction = ({
	report,
	view = 'overlay',
	...rest
}: PropsWithAction<WithReport>) => {
	const [_copiedText, copy] = useCopy()

	const handleClick = useMemoizedFn(async () => {
		const copyText = `${HOST}${links.reports.ref(report.public_id).index}`

		await copy(copyText)
		toast.success('Ссылка скопирована')
	})

	return (
		<>
			<Action
				onClick={handleClick}
				{...rest}
				view={view}
				icon={<IconLink size={18} />}
			>
				Ссылка на отчет
			</Action>
		</>
	)
}
