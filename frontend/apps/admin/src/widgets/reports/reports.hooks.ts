import { useUnit } from 'effector-react'

import { $reports } from '~widgets/reports/reports.atom'

export const useReportsStore = () => useUnit($reports)
