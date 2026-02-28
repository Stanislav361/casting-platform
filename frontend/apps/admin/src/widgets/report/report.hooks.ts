import { useUnit } from 'effector-react'

import { $report } from '~widgets/report/report.atom'

export const useReportStore = () => useUnit($report)
