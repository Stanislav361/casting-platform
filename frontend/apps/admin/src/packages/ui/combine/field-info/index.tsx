import type { AnyFieldApi } from '@tanstack/react-form'
import { memo } from 'react'

import { Error } from '~packages/ui'

export const FieldInfo = memo(({ field }: { field: AnyFieldApi }) => (
	<>
		{field.state.meta.isTouched && field.state.meta.errors.length ? (
			<Error>{field.state.meta.errors.join(',')}</Error>
		) : null}
		{field.state.meta.isValidating ? 'Валидируем...' : null}
	</>
))
