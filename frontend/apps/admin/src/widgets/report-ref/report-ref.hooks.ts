import { useUnit } from 'effector-react'

import { $reportRef } from '~widgets/report-ref/report-ref.atom'

export const useReportRefStore = () => useUnit($reportRef)
