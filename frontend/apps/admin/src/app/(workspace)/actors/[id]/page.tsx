'use client'

import { use, useMemo, useState } from 'react'

import Actor, { ActorAbout, ActorTab, ActorTabs } from '~widgets/actor'
import ActorResponses, {
	ActorResponsesFetcher,
	ActorResponsesPagination,
} from '~widgets/actor-responses'

import { ActorBackButton, useActor } from '~models/actor'

import { DataLoader } from '~packages/lib'

import { toActorID } from '@prostoprobuy/models'

import Loading from './loading'

export default function ActorPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = use(params)
	const { isLoading, isError, data } = useActor(toActorID(id))

	const [tab, setTab] = useState<ActorTab>('about')

	const content = useMemo(() => {
		switch (tab) {
			case 'about':
				return <ActorAbout actor={data?.data} />
			case 'responses':
				return (
					<>
						<ActorResponses />
						<ActorResponsesPagination />
						<ActorResponsesFetcher actor={toActorID(id)} />
					</>
				)
		}
	}, [tab, data?.data, id])

	return (
		<DataLoader
			isLoading={isLoading}
			hasError={isError}
			loadingFallback={<Loading />}
		>
			<ActorBackButton />
			<Actor actor={data?.data}>
				<ActorTabs tab={tab} setTab={tab => setTab(tab)} />
				{content}
			</Actor>
		</DataLoader>
	)
}
