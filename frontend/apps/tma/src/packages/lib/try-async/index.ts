import { isAxiosError } from 'axios'

import { axiosErrorHandler, TryAsync } from '@prostoprobuy/toolkit'

export async function tryAsync(fn: () => Promise<any>, options: TryAsync = {}) {
	const { onError, onFinally, errorText, processError = true } = options

	try {
		await fn()
	} catch (e) {
		errorText && alert(errorText)

		onError && !processError && onError?.(e)

		if (isAxiosError(e)) {
			processError && !onError && alert(axiosErrorHandler(e))
		} else {
			processError && !onError && alert('Возникла ошибка')
		}
	} finally {
		onFinally?.()
	}
}
