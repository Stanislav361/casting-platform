import { ChangeEventHandler } from 'react'

import { Select } from '~packages/ui'

import { SelectOption } from '@prostoprobuy/types'

const options: SelectOption[] = [
	{
		value: '',
		label: 'Все актеры',
	},
	{
		value: 'true',
		label: 'В кастинге',
	},
	{
		value: 'false',
		label: 'Без кастинга',
	},
]

export type ReportViaCastingSelectValue = undefined | 'true' | 'false'

interface ReportViaCastingSelectProps {
	value?: ReportViaCastingSelectValue
	onChange: ChangeEventHandler<HTMLSelectElement>
}

export const ReportViaCastingSelect = ({
	value,
	onChange,
}: ReportViaCastingSelectProps) => {
	return (
		<Select
			width={'max'}
			radius={'md'}
			options={options}
			value={value}
			onChange={onChange}
		/>
	)
}
