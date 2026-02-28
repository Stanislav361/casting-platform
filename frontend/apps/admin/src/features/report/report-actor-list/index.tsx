'use client'

import { useDeferredValue } from 'react'

import { ReportActorCard } from '~models/report'

import { IReportActor, WithReportID } from '@prostoprobuy/models'

interface ReportActorListProps extends Partial<WithReportID> {
	mode: 'edit' | 'view'
	actors: IReportActor[]
	checked: number[]
	onCheck: (id: number) => void
}

export function ReportActorList({
	mode,
	actors,
	checked,
	onCheck,
	report,
}: ReportActorListProps) {
	const list = useDeferredValue(actors, [])

	return list.map(actor => (
		<ReportActorCard
			mode={mode}
			key={actor.id}
			actor={actor}
			checked={checked}
			onCheck={onCheck}
			report={report}
		/>
	))
}
