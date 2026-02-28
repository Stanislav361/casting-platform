import {
	IconCalendarMinus,
	IconCalendarPlus,
	IconCalendarWeek,
	IconMovie,
	IconShare,
	IconUserCheck,
	IconUserMinus,
} from '@tabler/icons-react'
import Link from 'next/link'

import {
	ReportAction,
	ReportDeleteButton,
	ReportEditButton,
} from '~models/report'

import { CardModel, Flex, Grid, Tag } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { WithReport } from '@prostoprobuy/models'
import { formatDateInRu, placeholder } from '@prostoprobuy/toolkit'

import image from '~public/view-placeholder.png'

export const ReportCardActions = ({ report }: WithReport) => {
	return (
		<>
			<ReportEditButton report={report.id} view={'brand'} />
			<ReportAction report={report} onlyIcon={true} />
			<ReportDeleteButton report={report.id} onlyIcon={true} />
		</>
	)
}

export const ReportCard = ({ report }: WithReport) => {
	return (
		<CardModel
			data-report-id={report.id}
			image={report.image?.photo_url || image}
			imageAlt={report.title}
			imageWidth={239}
			imageHeight={226}
			actions={<ReportCardActions report={report} />}
		>
			<Flex alignItems={'center'} gap={12}>
				<Link href={links.reports.edit(report.id)}>{report.title}</Link>
			</Flex>
			<Grid
				columnGap={30}
				rowGap={10}
				gridTemplateColumns={'repeat(2, 1fr)'}
				width={'fit-content'}
			>
				<Tag icon={<IconMovie />} label={'Кастинг'}>
					{report.casting_title}
				</Tag>
				<Tag icon={<IconCalendarWeek />} label={'Дата'}>
					{formatDateInRu(report.created_at)}
				</Tag>
				<Tag icon={<IconUserCheck />} label={'Актеры через кастинг'}>
					{report.actors_via_casting}
				</Tag>
				<Tag icon={<IconUserMinus />} label={'Актеры без кастинга'}>
					{report.actors_without_casting}
				</Tag>
			</Grid>
		</CardModel>
	)
}
