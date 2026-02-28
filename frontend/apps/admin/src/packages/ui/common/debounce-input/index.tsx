'use client'

import { IconSearch, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Input } from '~packages/ui'

import { useDebounce } from '@prostoprobuy/hooks'

interface DebounceInputProps {
	value: string
	onChange: (value: string) => void
	loading?: boolean
}

const style = {
	cursor: 'pointer',
}

export const DebounceInput = ({
	value,
	onChange,
	loading,
}: DebounceInputProps) => {
	const [input, setInput] = useState(value)

	useEffect(() => {
		setInput(value)
	}, [value])

	const changeHandler = useDebounce((e: InputEvent) => {
		onChange(e.target.value)
	})

	const change = useCallback(
		e => {
			setInput(e.target.value)
			changeHandler(e)
		},
		[changeHandler],
	)

	const clear = useCallback(() => {
		setInput('')
		onChange('')
	}, [onChange])

	const isEmpty = useMemo(() => input?.trim() === '', [input])

	return (
		<Input
			before={<IconSearch size={18} />}
			after={
				!isEmpty && <IconX size={18} onClick={clear} style={style} />
			}
			radius={'md'}
			type={'text'}
			value={input}
			placeholder={'Поиск'}
			disabled={loading}
			onChange={change}
		/>
	)
}
