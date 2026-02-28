import { useQuery } from '@tanstack/react-query'

import { ProfileRepository } from '~models/profile/profile.repository'

import { profileConfig } from '@prostoprobuy/models'

export const useProfile = () => {
	return useQuery({
		queryKey: [profileConfig.profile],
		queryFn: () => ProfileRepository.get(),
	})
}
