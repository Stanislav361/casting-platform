import { useUnit } from 'effector-react'

import { $castings } from '~widgets/castings/castings.atom'

export const useCastingsStore = () => useUnit($castings)
