'use client'

import { useEffect, useState } from 'react'

import { useMemoizedFn } from './use-memoized-fn'

export const useModal = () => {
	const [isOpen, setIsOpen] = useState(false)

	const handleEscapeKey = useMemoizedFn((e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			document.body.style.overflow = 'auto'
			setIsOpen(false)
		}
	})

	useEffect(() => {
		window.addEventListener('keydown', handleEscapeKey)

		return () => {
			window.removeEventListener('keydown', handleEscapeKey)
		}
	}, [])

	const open = useMemoizedFn(() => {
		document.body.style.overflow = 'hidden'
		setIsOpen(true)
	})

	const close = useMemoizedFn(() => {
		document.body.style.overflow = 'auto'
		setIsOpen(false)
	})

	const toggle = useMemoizedFn(() => {
		document.body.style.overflow = isOpen ? 'auto' : 'hidden'
		setIsOpen(!isOpen)
	})

	return {
		isOpen,
		open,
		close,
		toggle,
	}
}
