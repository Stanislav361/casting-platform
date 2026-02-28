'use client'

import { FormHTMLAttributes, useCallback } from 'react'

export const Form = ({
	children,
	onSubmit,
	...props
}: FormHTMLAttributes<HTMLFormElement>) => {
	const handleSubmit = useCallback(
		e => {
			e.preventDefault()
			e.stopPropagation()
			onSubmit?.(e)
		},
		[onSubmit],
	)

	return (
		<form {...props} onSubmit={handleSubmit}>
			{children}
		</form>
	)
}
