import { useUnit } from 'effector-react'

import { $reportRefFavorites } from '~widgets/report-ref-favorites/report-ref-favorites.atom'

export const useReportRefFavoritesStore = () => useUnit($reportRefFavorites)
