import { useUnit } from 'effector-react'

import { $actors } from '~widgets/actors/actors.atom'

export const useActorsStore = () => useUnit($actors)
