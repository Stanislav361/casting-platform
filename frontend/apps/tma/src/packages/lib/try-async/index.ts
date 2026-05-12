import { isAxiosError } from 'axios'
import toast from 'react-hot-toast'

import { axiosErrorHandler, TryAsync } from '@prostoprobuy/toolkit'

export async function tryAsync(fn: () => Promise<any>, options: TryAsync = {}) {
	const { onError, onFinally, errorText, processError = true } = options

	try {
		await fn()
	} catch (e) {
		if (errorText) toast.error(errorText)

		onError && !processError && onError?.(e)

		if (isAxiosError(e)) {
			if (processError && !onError) toast.error(axiosErrorHandler(e) || 'Что-то пошло не так')
		} else {
			if (processError && !onError) toast.error('Что-то пошло не так. Попробуйте ещё раз.')
		}
	} finally {
		onFinally?.()
	}
}
