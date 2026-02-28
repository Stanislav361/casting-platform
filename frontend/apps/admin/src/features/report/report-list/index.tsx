'use client'

import { useDeferredValue } from 'react'

import { ReportCard } from '~models/report'

import { IReport } from '@prostoprobuy/models'

interface ReportListProps {
	reports: IReport[]
}

export const renderReportCard = (report: IReport) => {
	return <ReportCard key={report.id} report={report} />
}

export function ReportList({ reports }: ReportListProps) {
	const list = useDeferredValue(reports, [])

	return list.map(renderReportCard)
}
