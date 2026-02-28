import { useMutation } from '@tanstack/react-query'

import { AuthRepository } from '~models/auth/auth.repository'
import { TelegramAuth } from '~models/auth/auth.types'

export const useAuth = () => {
	return useMutation({
		mutationFn: (data: TelegramAuth) => AuthRepository.auth(data),
	})
}

export const usePredicate = () => {
	return useMutation({
		mutationFn: (predicate: boolean) => AuthRepository.predicate(predicate),
	})
}
