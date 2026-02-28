'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { BackButton } from '~packages/ui'

import { links } from '@prostoprobuy/links'

export const ActorBackButton = () => {
	const [link, setLink] = useState<string>(links.actors.index)
	const search = useSearchParams()

	const reportMode = search.get('mode')
	const reportId = search.get('report')

	useEffect(() => {
		if (reportMode && reportId) {
			if (reportMode === 'edit') {
				setLink(links.reports.edit(reportId))
			} else {
				setLink(links.reports.byId(reportId))
			}
		}
	}, [])

	return <BackButton href={link} />
}
