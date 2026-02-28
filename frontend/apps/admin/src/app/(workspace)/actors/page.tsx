import { Metadata } from 'next'

import Actors, {
	ActorsFetcher,
	ActorsFilter,
	ActorsPagination,
	ActorsSearch,
} from '~widgets/actors'

import { Group } from '~packages/ui'

export const metadata: Metadata = {
	title: 'Мои актеры',
}

export default function ActorsPage() {
	return (
		<Group>
			<ActorsSearch />
			<ActorsFilter />
			<Actors />
			<ActorsPagination />
			<ActorsFetcher />
		</Group>
	)
}
