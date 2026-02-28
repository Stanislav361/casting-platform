'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useMemoizedFn } from './use-memoized-fn'

export const useDropDown = <
	T extends HTMLElement = HTMLDivElement,
	U extends HTMLElement = HTMLButtonElement,
>() => {
	const dropdownRef = useRef<T>(null)
	const triggerRef = useRef<U>(null)
	const [isOpen, setIsOpen] = useState(false)

	const toggleDropDown = useMemoizedFn(() => {
		setIsOpen(prevIsOpen => !prevIsOpen)
	})

	const closeDropDown = useMemoizedFn(() => {
		setIsOpen(false)
	})

	const openDropDown = useMemoizedFn(() => {
		setIsOpen(true)
	})

	const handleOutsideClick = useCallback(
		(event: MouseEvent) => {
			const { current: dropdownElement } = dropdownRef
			const { current: triggerElement } = triggerRef
			if (
				triggerElement &&
				triggerElement.contains(event.target as Node)
			) {
				return
			}
			if (
				dropdownElement &&
				!dropdownElement.contains(event.target as Node)
			) {
				closeDropDown()
			}
		},
		[closeDropDown],
	)

	useEffect(() => {
		document.addEventListener('mousedown', handleOutsideClick)

		return () => {
			document.removeEventListener('mousedown', handleOutsideClick)
		}
	}, [closeDropDown])

	return {
		isOpenDropDown: isOpen,
		openDropDown,
		toggleDropDown,
		closeDropDown,
		dropdownRef,
		triggerRef,
	}
}
