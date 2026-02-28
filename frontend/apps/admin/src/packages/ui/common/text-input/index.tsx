import { DeepKeys, useForm } from '@tanstack/react-form'
import { InputHTMLAttributes } from 'react'

import { FieldInfo, Input } from '~packages/ui'

export const TextInput = <
	TFormData extends unknown,
	TNames extends DeepKeys<TFormData>,
>({
	form,
	name,
	...props
}: {
	form: ReturnType<typeof useForm<TFormData, any>>
	name: TNames
} & InputHTMLAttributes<HTMLInputElement>) => (
	<form.Field<TNames, any, any> name={name}>
		{field => (
			<>
				<Input
					value={field.state.value}
					onChange={e => field.handleChange(e.target.value)}
					onBlur={field.handleBlur}
					{...props}
				/>
				<FieldInfo field={field} />
			</>
		)}
	</form.Field>
)
