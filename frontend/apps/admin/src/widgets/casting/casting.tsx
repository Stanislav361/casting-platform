import { CastingAction } from '~features/casting'

import {
	CastingCloseButton,
	CastingEditButton,
	CastingResponsesButton,
	WithCasting,
} from '~models/casting'

import {
	Card,
	CardBody,
	CardTitle,
	Flex,
	Formatted,
	Group,
	Section,
} from '~packages/ui'

import { CastingStatus } from '@prostoprobuy/models'

import CastingHeader from './casting-header'

const CastingActions = ({ casting }: WithCasting) => (
	<Flex gap={14}>
		<CastingResponsesButton casting={casting.id} view={'brand-overlay'} />
		{casting.status === CastingStatus.unpublished && (
			<CastingEditButton casting={casting.id} view={'brand-overlay'} />
		)}
		<CastingAction casting={casting} />
		{casting.status === CastingStatus.published && (
			<CastingCloseButton casting={casting.id} view={'brand'} />
		)}
	</Flex>
)

export function Casting({ casting }: WithCasting) {
	return (
		<Card radius={'lg'}>
			<CardTitle action={<CastingActions casting={casting} />}>
				Информация о кастинге
			</CardTitle>
			<CardBody>
				<Group>
					<CastingHeader casting={casting} />
					<Section header={'Описание'}>
						<Formatted html={casting.description} />
					</Section>
				</Group>
			</CardBody>
		</Card>
	)
}
