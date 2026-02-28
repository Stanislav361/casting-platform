import { AnyFieldApi } from '@tanstack/react-form'
import { PropsWithChildren } from 'react'

import { Error, FieldInfo, Label, Spacing } from '~packages/ui'

interface FormRowProps extends PropsWithChildren {
	label?: string
	error?: string
	required?: boolean
	withOutMargin?: boolean
	field?: AnyFieldApi
}

export const FormRow = ({
	label,
	children,
	error,
	field,
	required,
	withOutMargin,
}: FormRowProps) => {
	return (
		<div>
			{label && <Label required={required}>{label}</Label>}

			{children}
			{field && <FieldInfo field={field} />}
			{error && <Error>{error}</Error>}
			{!withOutMargin && <Spacing />}
		</div>
	)
}
