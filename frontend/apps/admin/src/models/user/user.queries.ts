import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { UserRepository } from '~models/user/user.repository'

import { userConfig, UseUsers } from '@prostoprobuy/models'

export const useUsers = (params?: Partial<UseUsers>) => {
	return useQuery({
		queryKey: [userConfig.users, params],
		queryFn: () => UserRepository.all(params),
		placeholderData: keepPreviousData,
	})
}

export const useCurrentUser = () => {
	return useQuery({
		queryKey: [userConfig.user],
		queryFn: () => UserRepository.current(),
	})
}
