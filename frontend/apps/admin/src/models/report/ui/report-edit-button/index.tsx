'use client'

import { IconPencil } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { Action } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { WithReportID } from '@prostoprobuy/models'

export const ReportEditButton = ({
	report,
	...rest
}: PropsWithAction<WithReportID>) => {
	const router = useRouter()

	const handleClick = useCallback(() => {
		router.push(links.reports.byId(report))
	}, [report, router])

	return (
		<Action onClick={handleClick} {...rest} icon={<IconPencil size={18} />}>
			Редактировать
		</Action>
	)
}
