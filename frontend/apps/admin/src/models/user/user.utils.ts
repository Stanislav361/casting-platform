import { FilterDrawerKeyof } from '~features/shared'

import { UseUsers } from '@prostoprobuy/models'

export const parseUserFilterFields: FilterDrawerKeyof<UseUsers> = {
	role: 'Роль',
}
