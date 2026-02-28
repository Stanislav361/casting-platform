import { IconCalendarCheck, IconMail, IconPhone } from '@tabler/icons-react'
import Link from 'next/link'

import { ActorTags, ActorTelegramButton, ActorViewButton } from '~models/actor'
import { ReportActorDeleteButton } from '~models/report'

import { CardModel, Checkbox, Checked, Chip, Flex, Tooltip } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import {
	actorFullName,
	WithReportActor,
	WithReportID,
} from '@prostoprobuy/models'
import { formatDateInRu, formatYears } from '@prostoprobuy/toolkit'

import image from '~public/user-placeholder.png'

export const ReportActorCardActions = ({
	actor,
	report,
}: WithReportActor & Partial<WithReportID>) => {
	return (
		<>
			<ActorViewButton actor={actor.id} view={'brand'} />
			<Tooltip label={'Написать в Telegram'}>
				<ActorTelegramButton
					telegram_url={actor.telegram_url}
					view={'overlay'}
					onlyIcon={true}
				/>
			</Tooltip>
			{report && (
				<Tooltip label={'Удалить из отчета'}>
					<ReportActorDeleteButton
						report={report}
						actor={actor.id}
						onlyIcon={true}
					/>
				</Tooltip>
			)}
		</>
	)
}

interface ReportActorCardProps extends WithReportActor, Partial<WithReportID> {
	mode: 'edit' | 'view'
	checked: number[]
	onCheck: (id: number) => void
}

export const ReportActorCard = ({
	mode,
	actor,
	report,
	onCheck,
	checked,
}: ReportActorCardProps) => {
	return (
		<CardModel
			data-actor-id={actor.id}
			image={actor.image?.photo_url || image}
			imageAlt={actorFullName(actor)}
			imageWidth={241}
			imageHeight={226}
			actions={<ReportActorCardActions actor={actor} report={report} />}
			checkbox={
				<Checkbox
					checked={checked.includes(actor.id)}
					onChange={() => onCheck(actor.id)}
				/>
			}
		>
			<Flex alignItems={'center'} gap={10} lineHeight={1}>
				<Link
					href={links.actors.byId(
						actor.id,
						`mode=${mode}&report=${report}`,
					)}
				>
					{actorFullName(actor)}
				</Link>
				<Tooltip
					label={actor.via_casting ? 'В кастинге' : 'Не в кастинге'}
				>
					<Checked checked={actor.via_casting} />
				</Tooltip>
			</Flex>
			<Flex alignItems={'center'} gap={8} flexWrap={'wrap'}>
				{actor.city && (
					<Chip variant={'info'} size={'md'}>
						Город {actor.city.name}
					</Chip>
				)}
				{actor.age && (
					<Chip variant={'flat'} size={'md'}>
						Возраст {formatYears(actor.age)}
					</Chip>
				)}
				{actor.experience && (
					<Chip variant={'info'} size={'md'}>
						Опыт {formatYears(actor.experience)}
					</Chip>
				)}
				{actor.email && (
					<Chip variant={'default'} size={'md'}>
						<IconMail size={16} />
						{actor.email}
					</Chip>
				)}
				{actor.phone_number && (
					<Chip variant={'default'} size={'md'}>
						<IconPhone size={16} /> {actor.phone_number}
					</Chip>
				)}
				{actor.response_at && (
					<Chip variant={'default'} size={'md'}>
						<IconCalendarCheck size={16} /> {formatDateInRu(actor.response_at)}
					</Chip>
				)}
			</Flex>
			<ActorTags
				gender={actor.gender}
				qualification={actor.qualification}
				look_type={actor.look_type}
				height={actor.height}
				clothing_size={actor.clothing_size}
				shoe_size={actor.shoe_size}
			/>
		</CardModel>
	)
}
