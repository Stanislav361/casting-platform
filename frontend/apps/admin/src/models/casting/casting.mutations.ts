import { useMutation } from '@tanstack/react-query'

import { CastingRepository } from '~models/casting/casting.repository'

import {
	castingConfig,
	CastingID,
	ICastingImage,
	ICreateCasting,
	ImageID,
	IUpdateCasting,
} from '@prostoprobuy/models'
import { optimisticInvalidateQueries } from '@prostoprobuy/toolkit'

export const useCreateCasting = () => {
	return useMutation({
		mutationFn: (data: ICreateCasting) => CastingRepository.create(data),
		onSettled: async () => {
			await optimisticInvalidateQueries([[castingConfig.castings]])
		},
	})
}

export const useUpdateCasting = (id: CastingID) => {
	return useMutation({
		mutationFn: (data: Partial<IUpdateCasting>) =>
			CastingRepository.update(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[castingConfig.castings],
				[castingConfig.casting, id],
			])
		},
	})
}

export const useDeleteCasting = () => {
	return useMutation({
		mutationFn: (id: CastingID) => CastingRepository.delete(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([[castingConfig.castings]])
		},
	})
}

export const usePublishCasting = (id: CastingID) => {
	return useMutation({
		mutationFn: () => CastingRepository.publish(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[castingConfig.castings],
				[castingConfig.casting, id],
			])
		},
	})
}

export const useUnpublishCasting = (id: CastingID) => {
	return useMutation({
		mutationFn: () => CastingRepository.unpublish(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[castingConfig.castings],
				[castingConfig.casting, id],
			])
		},
	})
}

export const useCloseCasting = (id: CastingID) => {
	return useMutation({
		mutationFn: () => CastingRepository.close(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[castingConfig.castings],
				[castingConfig.casting, id],
			])
		},
	})
}

export const useAddCastingImage = (id: CastingID) => {
	return useMutation({
		mutationFn: (data: ICastingImage) =>
			CastingRepository.addImage(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[castingConfig.castings],
				[castingConfig.casting, id],
			])
		},
	})
}

export const useDeleteCastingImage = () => {
	return useMutation({
		mutationFn: (id: ImageID) => CastingRepository.deleteImage(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[castingConfig.castings],
				[castingConfig.casting],
			])
		},
	})
}
