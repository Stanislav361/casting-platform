'use client'

import { useEffect } from 'react'

import {
	setCount,
	setError,
	setList,
	setLoading,
	useReportsStore,
} from '~widgets/reports'

import { useReports } from '~models/report'

export const ReportsFetcher = () => {
	const { filter } = useReportsStore()

	const { data, isLoading, isError } = useReports(filter)

	useEffect(() => {
		setLoading(isLoading)
		setError(isError)
		if (!isLoading && data?.data) {
			setCount(data.data.meta.total_rows)
			setList(data.data.response)
		}
	}, [data, isLoading, isError])

	return null
}
