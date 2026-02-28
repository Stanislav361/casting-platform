'use client'

import {
	cloneElement,
	isValidElement,
	PropsWithChildren,
	useCallback,
} from 'react'

import { Relative } from '~packages/ui'
import { DropdownContainer } from '~packages/ui/element/drop-down/drop-down-container'

import { useDropDown } from '@prostoprobuy/hooks'

interface DropdownProps extends PropsWithChildren {
	trigger?: ReactElement
}

export * from './drop-down-action'
export * from './drop-down-item'

export const Dropdown = ({ trigger, children }: DropdownProps) => {
	const { isOpenDropDown, toggleDropDown, dropdownRef, triggerRef } =
		useDropDown()

	const handleClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation()
			toggleDropDown()

			if (isValidElement(trigger) && trigger.props.onClick) {
				trigger.props.onClick(e)
			}
		},
		[toggleDropDown, trigger],
	)

	if (!isValidElement(trigger)) return null

	return (
		<Relative>
			{cloneElement(trigger, {
				ref: triggerRef,
				onClick: handleClick,
			})}
			{isOpenDropDown && (
				<DropdownContainer ref={dropdownRef}>
					{children}
				</DropdownContainer>
			)}
		</Relative>
	)
}
