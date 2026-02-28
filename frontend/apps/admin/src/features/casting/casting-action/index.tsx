import { match } from 'ts-pattern'

import {
	CastingOpenButton,
	CastingUnopenButton,
	WithCasting,
} from '~models/casting'

import { CastingStatus } from '@prostoprobuy/models'

export const CastingAction = ({ casting }: WithCasting) =>
	match(casting.status)
		.with(CastingStatus.unpublished, () => (
			<CastingOpenButton casting={casting.id} view={'brand'} />
		))
		.with(CastingStatus.published, () => (
			<CastingUnopenButton casting={casting.id} view={'brand'} />
		))
		.otherwise(() => null)
