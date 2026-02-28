import { useUnit } from 'effector-react'

import { $reportEdit } from '~widgets/report-edit/report-edit.atom'

export const useReportEditStore = () => useUnit($reportEdit)
