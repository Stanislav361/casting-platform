import { ReportID, ReportPublicID } from './report.types'

export const toReportID = (id: number | string): ReportID =>
	Number(id) as ReportID

export const toReportPublicID = (id: number | string): ReportPublicID =>
	String(id) as ReportPublicID

export const REPORT_SORT_BY_OPTIONS = [
	{
		label: 'По алфавиту',
		value: 'title',
	},
	{
		label: 'По дате создания',
		value: 'created_at',
	},
]
