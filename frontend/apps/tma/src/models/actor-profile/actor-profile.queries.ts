import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
	actorProfileRepository,
	authV2Repository,
} from './actor-profile.repository'
import type {
	IActorProfileCreate,
	IActorProfileUpdate,
	IEmailPasswordLogin,
	IEmailPasswordRegister,
	IOTPSend,
	IOTPVerify,
} from './actor-profile.types'

// ─── Query Keys ───
export const actorProfileKeys = {
	all: ['actor-profiles'] as const,
	myProfiles: ['actor-profiles', 'my'] as const,
	detail: (id: number) => ['actor-profiles', id] as const,
}

// ─── Queries ───

export function useMyProfiles() {
	return useQuery({
		queryKey: actorProfileKeys.myProfiles,
		queryFn: async () => {
			const response = await actorProfileRepository.getMyProfiles()
			return response.data
		},
	})
}

export function useActorProfile(profileId: number | null) {
	return useQuery({
		queryKey: actorProfileKeys.detail(profileId!),
		queryFn: async () => {
			const response = await actorProfileRepository.getProfile(profileId!)
			return response.data
		},
		enabled: !!profileId,
	})
}

// ─── Mutations ───

export function useCreateProfile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: IActorProfileCreate) =>
			actorProfileRepository.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.myProfiles,
			})
		},
	})
}

export function useUpdateProfile(profileId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: IActorProfileUpdate) =>
			actorProfileRepository.updateProfile(profileId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.detail(profileId),
			})
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.myProfiles,
			})
		},
	})
}

export function useUploadPhoto(profileId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({
			file,
			photoCategory,
		}: {
			file: File
			photoCategory: 'portrait' | 'profile' | 'full_height' | 'additional'
		}) => actorProfileRepository.uploadPhoto(profileId, file, photoCategory),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.detail(profileId),
			})
		},
	})
}

export function useUploadVideo(profileId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (file: File) =>
			actorProfileRepository.uploadVideo(profileId, file),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.detail(profileId),
			})
		},
	})
}

export function useDeleteMedia(profileId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (assetId: number) =>
			actorProfileRepository.deleteMedia(profileId, assetId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.detail(profileId),
			})
		},
	})
}

export function useSetPrimaryMedia(profileId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (assetId: number) =>
			actorProfileRepository.setPrimaryMedia(profileId, assetId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.detail(profileId),
			})
		},
	})
}

// ─── Auth V2 Mutations ───

export function useEmailLogin() {
	return useMutation({
		mutationFn: (data: IEmailPasswordLogin) =>
			authV2Repository.login(data),
	})
}

export function useEmailRegister() {
	return useMutation({
		mutationFn: (data: IEmailPasswordRegister) =>
			authV2Repository.register(data),
	})
}

export function useSendOTP() {
	return useMutation({
		mutationFn: (data: IOTPSend) => authV2Repository.sendOTP(data),
	})
}

export function useVerifyOTP() {
	return useMutation({
		mutationFn: (data: IOTPVerify) => authV2Repository.verifyOTP(data),
	})
}

export function useSwitchProfile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (profileId: number) =>
			authV2Repository.switchProfile(profileId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: actorProfileKeys.myProfiles,
			})
		},
	})
}


