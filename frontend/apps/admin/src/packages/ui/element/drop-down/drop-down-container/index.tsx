'use client'

import cn from 'classnames'
import {
	forwardRef,
	MutableRefObject,
	PropsWithChildren,
	useCallback,
	useRef,
} from 'react'

import styles from './index.module.scss'

interface DropdownContainerProps extends PropsWithChildren {
	position?: 'left' | 'right'
	className?: string
}

export const DropdownContainer = forwardRef<
	HTMLDivElement,
	DropdownContainerProps
>(({ children, position = 'right', className }, ref) => {
	const containerRef = useRef<HTMLDivElement>(null)

	const combinedRef = useCallback(
		(node: HTMLDivElement) => {
			containerRef.current = node
			if (node) {
				const trigger = node.previousSibling as HTMLElement
				node.style.top = `${trigger.offsetHeight + 6}px`
				node.style.bottom = `auto`
				node.style.right = `${trigger.offsetWidth - trigger.offsetWidth}px`
				node.style.left = `auto`
			}
			if (typeof ref === 'function') {
				ref(node)
			} else if (ref) {
				ref = ref as MutableRefObject<HTMLDivElement | null>
				ref.current = node
			}
		},
		[ref],
	)

	return (
		<div
			ref={combinedRef}
			className={cn(styles.overlay__dropdown__container, className)}
		>
			{children}
		</div>
	)
})
