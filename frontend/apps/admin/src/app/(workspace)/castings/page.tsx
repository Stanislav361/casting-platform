import { Metadata } from 'next'

import Castings, {
	CastingsFetcher,
	CastingsFilter,
	CastingsPagination,
	CastingsSearch,
} from '~widgets/castings'

import { CastingsTabs } from '~features/casting'

import { Group } from '~packages/ui'

export const metadata: Metadata = {
	title: 'Мои кастинги',
}

export default function CastingsPage() {
	return (
		<Group>
			<CastingsTabs active={'active'} />
			<CastingsSearch />
			<CastingsFilter />
			<Castings />
			<CastingsPagination />
			<CastingsFetcher />
		</Group>
	)
}
