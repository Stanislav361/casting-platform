'use client'

import { Dispatch, SetStateAction, useCallback, useState } from 'react'

export const useToggle = (
	init = false,
): [boolean, () => void, Dispatch<SetStateAction<boolean>>] => {
	const [value, setValue] = useState(init)

	const toggle = useCallback(() => {
		setValue(x => !x)
	}, [])

	return [value, toggle, setValue]
}
