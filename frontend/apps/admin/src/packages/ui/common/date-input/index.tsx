'use client'

import { useMask } from '@react-input/mask'
import { ChangeEvent, forwardRef, useEffect, useState } from 'react'

import { Error, Input, InputProps } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { DATE_MASK } from '@prostoprobuy/system'
import { mergeRefs } from '@prostoprobuy/toolkit'

export const DateInput = forwardRef<HTMLInputElement, InputProps>(
	({ onChange, value: propValue, error: propError, ...props }, ref) => {
		const [value, setValue] = useState(propValue || '')
		const [error, setError] = useState<string | boolean | null>(propError)

		const inputRef = useMask({
			mask: DATE_MASK,
			replacement: { d: /\d/, m: /\d/, y: /\d/ },
			showMask: true,
		})

		const validateDate = useMemoizedFn((dateStr: string) => {
			if (!dateStr) {
				setError(null)
				return true
			}

			if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
				setError('Некорректный формат даты')
				return false
			}

			const [dayStr, monthStr, yearStr] = dateStr.split('.')
			const day = parseInt(dayStr, 10)
			const month = parseInt(monthStr, 10)
			const year = parseInt(yearStr, 10)

			if (year < 1900) {
				setError('Год должен быть от 1900 и выше')
				return false
			}

			if (month < 1 || month > 12) {
				setError('Месяц должен быть от 1 до 12')
				return false
			}

			if (day < 1 || day > 31) {
				setError('День должен быть от 1 до 31')
				return false
			}

			const thirtyDayMonths = [4, 6, 9, 11]
			if (thirtyDayMonths.includes(month) && day > 30) {
				setError(`В этом месяце не может быть больше 30 дней`)
				return false
			}

			if (month === 2) {
				const isLeapYear =
					(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
				if (day > (isLeapYear ? 29 : 28)) {
					setError(`В феврале ${isLeapYear ? '29' : '28'} дней`)
					return false
				}
			}

			setError(null)
			return true
		})

		const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setValue(newValue)
			if (validateDate(newValue)) onChange?.(e)
		}

		useEffect(() => {
			if (propValue !== undefined) {
				setValue(propValue)
				validateDate(propValue as string)
			}
		}, [propValue])

		return (
			<>
				<Input
					ref={mergeRefs(ref, inputRef)}
					value={value}
					onChange={handleChange}
					error={error}
					{...props}
				/>
				{error && <Error>{error}</Error>}
			</>
		)
	},
)
