import { useUnit } from 'effector-react'

import { $archive } from '~widgets/archive/archive.atom'

export const useArchiveStore = () => useUnit($archive)
