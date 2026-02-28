import { AxiosError, isAxiosError } from 'axios'
import { Message } from 'react-hook-form'
import toast from 'react-hot-toast'

import { ValidationErrorResponse } from '@prostoprobuy/types'

export type TryAsync = {
	onError?: (error: AxiosError) => void
	onFinally?: () => void
	errorText?: string
	processError?: boolean
}

export const axiosErrorHandler = (e: AxiosError): Message => {
	if (!e.response) return 'Возникла ошибка'

	if (typeof e.response === 'string') return e.response

	const res: ValidationErrorResponse = e.response
		.data as ValidationErrorResponse

	if (typeof res.detail === 'string') return res.detail

	if (res.detail['message']) return res.detail['message']

	if (Array.isArray(res.detail) && res.detail[0])
		return res.detail[0].msg as string

	return 'Возникла ошибка'
}

export async function tryAsync(fn: () => Promise<any>, options: TryAsync = {}) {
	const { onError, onFinally, errorText, processError = true } = options

	try {
		await fn()
	} catch (e) {
		errorText && toast.error(errorText)

		onError && !processError && onError?.(e)

		if (isAxiosError(e)) {
			processError && !onError && toast.error(axiosErrorHandler(e))
		} else {
			processError && !onError && toast.error('Возникла ошибка')
		}
	} finally {
		onFinally?.()
	}
}
