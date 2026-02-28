'use client'

import { useDeferredValue } from 'react'

import { RefActorCard } from '~models/report'

import {
	IProducerReportListActor,
	WithReportPublicID,
} from '@prostoprobuy/models'

interface RefActorListProps extends WithReportPublicID {
	refs: IProducerReportListActor[]
}

export function RefActorList({ refs, report }: RefActorListProps) {
	const list = useDeferredValue(refs, [])

	return list.map(ref => (
		<RefActorCard key={ref.id} actor={ref} report={report} />
	))
}
