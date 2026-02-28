import { Metadata } from 'next'

import Reports, {
	ReportsFetcher,
	ReportsFilter,
	ReportsPagination,
	ReportsSearch,
} from '~widgets/reports'

import { Group } from '~packages/ui'

export const metadata: Metadata = {
	title: 'Мои отчёты',
}

export default function ReportsPage() {
	return (
		<Group>
			<ReportsSearch />
			<ReportsFilter />
			<Reports />
			<ReportsPagination />
			<ReportsFetcher />
		</Group>
	)
}
