import { useMutation } from '@tanstack/react-query'

import { AuthRepository } from '~models/auth/auth.repository'

import { TelegramAuthData } from '@prostoprobuy/models'

export const useAuth = () => {
	return useMutation({
		mutationFn: (data: TelegramAuthData) => AuthRepository.auth(data),
	})
}

export const usePredicate = () => {
	return useMutation({
		mutationFn: (predicate: boolean) => AuthRepository.predicate(predicate),
	})
}
