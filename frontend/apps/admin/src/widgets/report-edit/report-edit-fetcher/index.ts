'use client'

import { useEffect } from 'react'

import {
	setActions,
	setChecked,
	setCount,
	setError,
	setList,
	setLoading,
	useReportEditStore,
} from '~widgets/report-edit'

import { useReportActors, useReportActorsIds } from '~models/report'

import { WithReportID } from '@prostoprobuy/models'

export const ReportEditFetcher = ({ report }: WithReportID) => {
	const { filter } = useReportEditStore()

	const { data, isLoading, isError } = useReportActors(report, filter)

	const { data: ids, isLoading: idsLoading } = useReportActorsIds(
		report,
		filter,
	)

	useEffect(() => {
		setLoading(isLoading)
		setError(isError)
		if (!isLoading && data?.data) {
			setCount(data.data.meta.total_rows)
			setList(data.data.response)
		}
	}, [data, isLoading, isError])

	useEffect(() => {
		setLoading(idsLoading)
		if (!idsLoading && ids?.data) {
			setChecked(ids.data.response)
			setActions(ids.data.response)
		}
	}, [ids, idsLoading])

	return null
}
