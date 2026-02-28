import { useUnit } from 'effector-react'

import { $users } from '~widgets/users/users.atom'

export const useUsersStore = () => useUnit($users)
