'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
} from '~widgets/report/report.atom'
import { useReportStore } from '~widgets/report/report.hooks'

import { useFullReport } from '~models/report'

import { WithReportID } from '@prostoprobuy/models'

export const ReportFetcher = ({ report }: WithReportID) => {
	const { filter } = useReportStore()

	const { data, isLoading, isError } = useFullReport(report, filter)

	useEffect(() => {
		setLoading(isLoading)
		setError(isError)
		if (!isLoading && data?.data) {
			setCount(data.data.actors.meta.total_rows)
			setList(data.data.actors.response)
		}
	}, [data, isLoading, isError])

	return null
}
