import { PropsWithChildren } from 'react'

import ActorHead from '~widgets/actor/actor-head'

import { Card, CardBody, CardTitle, Group } from '~packages/ui'

import { WithActor } from '@prostoprobuy/models'

export function Actor({ actor, children }: PropsWithChildren<WithActor>) {
	return (
		<Card radius={'lg'}>
			<CardTitle>Информация об актёре</CardTitle>
			<CardBody>
				<Group>
					<ActorHead actor={actor} />
					{children}
				</Group>
			</CardBody>
		</Card>
	)
}
