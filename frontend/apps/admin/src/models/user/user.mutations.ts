import { useMutation } from '@tanstack/react-query'

import { UserRepository } from '~models/user/user.repository'

import { Roles, userConfig, UserID } from '@prostoprobuy/models'
import { optimisticInvalidateQueries } from '@prostoprobuy/toolkit'

export const useUserRoles = (id: UserID) => {
	return useMutation({
		mutationFn: (data: Roles) => UserRepository.roles(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[userConfig.users],
				[userConfig.user],
			])
		},
	})
}
