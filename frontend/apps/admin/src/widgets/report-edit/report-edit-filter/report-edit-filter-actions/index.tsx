import { WithReportID } from '@prostoprobuy/models'

import { ReportEditPushButton } from './report-edit-push-button'
import { ReportEditRemoveButton } from './report-edit-remove-button'

export const ReportEditFilterActions = ({ report }: WithReportID) => {
	return (
		<>
			<ReportEditPushButton report={report} />
			<ReportEditRemoveButton report={report} />
		</>
	)
}
