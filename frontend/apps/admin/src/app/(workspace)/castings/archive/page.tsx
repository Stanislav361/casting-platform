import { Metadata } from 'next'

import Archive, {
	ArchiveFetcher,
	ArchiveFilter,
	ArchivePagination,
	ArchiveSearch,
} from '~widgets/archive'

import { CastingsTabs } from '~features/casting'

import { Group } from '~packages/ui'

export const metadata: Metadata = {
	title: 'Архив кастингов',
}

export default function CastingsArchivePage() {
	return (
		<Group>
			<CastingsTabs active={'archive'} />
			<ArchiveSearch />
			<ArchiveFilter />
			<Archive />
			<ArchivePagination />
			<ArchiveFetcher />
		</Group>
	)
}
