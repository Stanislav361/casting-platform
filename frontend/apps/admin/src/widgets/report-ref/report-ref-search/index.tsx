'use client'

import { useMemo } from 'react'

import { setFilter, useReportRefStore } from '~widgets/report-ref'

import { useProducerReportStore } from '~models/report'

import { useDeviceDetect } from '~packages/hooks'
import { Card, CardBody, CardTitle, DebounceInput, Flex } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { formatDateInRuFull } from '@prostoprobuy/toolkit'

export const ReportRefSearch = () => {
	const { isMobile } = useDeviceDetect()

	const { loading, filter, count } = useReportRefStore()

	const { data } = useProducerReportStore()

	const changeHandler = useMemoizedFn(e =>
		setFilter({
			search: e,
		}),
	)

	const updatedAt = useMemo(
		() => <>Обновлен {formatDateInRuFull(data.updated_at)}</>,
		[data.updated_at],
	)

	return (
		<Card radius={'lg'}>
			<CardTitle action={updatedAt} caption={`Актеров в отчете ${count}`}>
				Отчет по кастингу «{data.title}»
			</CardTitle>
			<CardBody>
				<Flex alignItems={'center'} gap={16}>
					<DebounceInput
						onChange={changeHandler}
						value={filter.search}
						disabled={loading}
					/>
				</Flex>
			</CardBody>
		</Card>
	)
}
