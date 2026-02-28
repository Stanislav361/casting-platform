import { useUnit } from 'effector-react'

import { $profile, $profileTab } from '~widgets/profile/profile.atom'

export const useProfileStore = () => useUnit($profile)

export const useProfileTabStore = () => useUnit($profileTab)
