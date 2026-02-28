import { useUnit } from 'effector-react'

import { $session } from './auth.atom'

export const useSession = () => useUnit($session)

export const useCheckAuth = (): boolean => Boolean(useSession().access_token)
