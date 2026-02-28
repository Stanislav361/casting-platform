import { useQuery } from '@tanstack/react-query'

import { AuthRepository } from '~models/auth/auth.repository'

import { authConfig } from '@prostoprobuy/models'

export const useRefreshToken = () => {
	return useQuery({
		queryKey: [authConfig.auth],
		queryFn: () => AuthRepository.refreshToken(),
	})
}
