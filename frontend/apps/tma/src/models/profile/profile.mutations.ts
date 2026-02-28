import { useMutation } from '@tanstack/react-query'

import {
	ProfileImageRepository,
	ProfileRepository,
} from '~models/profile/profile.repository'
import { ProfileResponse } from '~models/profile/profile.types'

import {
	castingConfig,
	CastingID,
	IProfileImage,
	IUpdateProfile,
	profileConfig,
} from '@prostoprobuy/models'
import { optimisticInvalidateQueries } from '@prostoprobuy/toolkit'

export const useUpdateProfile = () => {
	return useMutation({
		mutationFn: (data: Partial<IUpdateProfile>) =>
			ProfileRepository.update(data),
		onSettled: async () => {
			await optimisticInvalidateQueries([[profileConfig.profile]])
		},
	})
}

export const useCreateResponse = (casting: CastingID) => {
	return useMutation({
		mutationFn: (data: ProfileResponse) =>
			ProfileRepository.createResponse(casting, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([[castingConfig.casting]])
		},
	})
}

export const useUpdateResponse = (casting: CastingID) => {
	return useMutation({
		mutationFn: (data: ProfileResponse) =>
			ProfileRepository.updateResponse(casting, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([[castingConfig.casting]])
		},
	})
}

export const useAddProfileImage = () => {
	return useMutation({
		mutationFn: (data: IProfileImage) =>
			ProfileImageRepository.addImageAlone(data),
		onSettled: async () => {
			await optimisticInvalidateQueries([[profileConfig.profile]])
		},
	})
}

export const useDeleteProfileImage = () => {
	return useMutation({
		mutationFn: (id: number) => ProfileImageRepository.deleteImage(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([[profileConfig.profile]])
		},
	})
}
