'use client'

import {
	setFilter,
	useReportRefFavoritesStore,
} from '~widgets/report-ref-favorites'

import { ReportClearFavoritesButton } from '~models/report'

import { useDeviceDetect } from '~packages/hooks'
import {
	Card,
	CardBody,
	CardTitle,
	DebounceInput,
	Flex,
	Spacing,
} from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { WithReportPublicID } from '@prostoprobuy/models'

export const ReportRefFavoritesSearch = ({ report }: WithReportPublicID) => {
	const { isMobile } = useDeviceDetect()

	const { loading, filter, count } = useReportRefFavoritesStore()

	const changeHandler = useMemoizedFn(e =>
		setFilter({
			search: e,
		}),
	)

	return (
		<Card radius={'lg'}>
			<CardTitle
				backHref={links.reports.ref(report).index}
				action={
					<>
						{isMobile && <Spacing v={'xs'} />}
						<ReportClearFavoritesButton
							report={report}
							width={isMobile ? 'max' : 'auto'}
						/>
					</>
				}
				caption={`Актеров в избранном ${count}`}
			>
				Избранные актеры
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
