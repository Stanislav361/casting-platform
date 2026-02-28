'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
	useReportRefStore,
} from '~widgets/report-ref'

import {
	setProducerReport,
	setProducerReportError,
	setProducerReportLoading,
	useProducerReportActors,
} from '~models/report'

import { WithReportPublicID } from '@prostoprobuy/models'

export const ReportRefFetcher = ({ report }: WithReportPublicID) => {
	const { filter } = useReportRefStore()

	const { data, isLoading, isError } = useProducerReportActors(report, filter)

	useEffect(() => {
		setLoading(isLoading)
		setError(isError)
		setProducerReportLoading(isLoading)
		setProducerReportError(isError)
		if (!isLoading && data?.data) {
			setProducerReport({
				id: data.data.id,
				title: data.data.title,
				updated_at: data.data.updated_at,
			})
			setCount(data.data.actors.meta.total_rows)
			setList(data.data.actors.response)
		}
	}, [data, isLoading, isError])

	return null
}
