'use client'

import { IconClipboard } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { CSSProperties, useMemo } from 'react'

import { ReportClearButton } from '~models/report'

import { Badge, Button, Flex, Modal, Separator, Spacing } from '~packages/ui'

import { useModal } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { WithReport } from '@prostoprobuy/models'

interface ReportSeparationProps {
	left: string
	right: string | number
	noSeparator?: boolean
}

const styleRight: CSSProperties = {
	fontSize: 14,
}

const styleLeft: CSSProperties = {
	fontSize: 14,
	color: 'var(--color-grey)',
}

const ReportSeparation = ({
	left,
	right,
	noSeparator,
}: ReportSeparationProps) => {
	return (
		<>
			<Flex alignItems={'center'} justifyContent={'space-between'}>
				<span style={styleLeft}>{left}</span>
				<span style={styleRight}>{right}</span>
			</Flex>
			{!noSeparator && (
				<>
					<Spacing v={'xs'} />
					<Separator />
					<Spacing v={'xs'} />
				</>
			)}
		</>
	)
}

export const ReportModal = ({ report }: WithReport) => {
	const router = useRouter()
	const { open, isOpen, close, toggle } = useModal()

	const actors = useMemo(
		() => report.actors_via_casting + report.actors_without_casting,
		[report.actors_via_casting, report.actors_without_casting],
	)

	return (
		<>
			<Badge content={actors.toString()} placement={'top-right'}>
				<Button view={'brand'} onClick={open}>
					<IconClipboard size={20} />
					Об отчете
				</Button>
			</Badge>

			{isOpen && (
				<Modal open={isOpen} onClose={close} key={'1'}>
					<Modal.Header>Информация об отчете</Modal.Header>
					<Modal.Body>
						<ReportSeparation
							left={'Название отчета:'}
							right={report.title}
						/>
						<ReportSeparation
							left={'Кастинг:'}
							right={report.casting_title}
						/>
						<ReportSeparation
							left={'Откликнулось:'}
							right={report.actors_via_casting}
						/>
						<ReportSeparation
							left={'Не откликнулось:'}
							right={report.actors_without_casting}
							noSeparator={true}
						/>
					</Modal.Body>
					<Modal.Footer>
						<Flex alignItems={'center'} gap={20}>
							<ReportClearButton
								report={report.id}
								width={'max'}
								trigger={toggle}
							/>
							<Button
								view={'brand'}
								width={'max'}
								onClick={() => {
									close()
									router.replace(
										links.reports.edit(report.id),
									)
								}}
							>
								Перейти в отчет
							</Button>
						</Flex>
					</Modal.Footer>
				</Modal>
			)}
		</>
	)
}
