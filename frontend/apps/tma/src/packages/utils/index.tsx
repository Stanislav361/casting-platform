import { ReactNode } from 'react'

export const jsxSelectOptions = (object: Record<string, any>): ReactNode => {
	return Object.entries(object).map(([key, value]) => {
		return <option value={key}>{value}</option>
	})
}
