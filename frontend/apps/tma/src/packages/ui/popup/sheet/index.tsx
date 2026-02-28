'use client'

import { IconX } from '@tabler/icons-react'
import {
	CSSProperties,
	memo,
	PropsWithChildren,
	ReactNode,
	useRef,
} from 'react'
import { useState } from 'react'
import { Sheet as ModalSheet, SheetRef } from 'react-modal-sheet'

import { useResizeVisualViewport } from '@prostoprobuy/hooks'
import { ModalProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface SheetProps extends PropsWithChildren, ModalProps {
	height?: number
	header?: ReactNode
	footer?: ReactNode
}

const containerStyle: CSSProperties = {
	backgroundColor: 'var(--tg-theme-secondary-bg-color)',
	borderRadius: '16px 16px 0 0',
	boxShadow: 'none',
	padding: '0 16px 32px 16px',
	fontFamily: 'inherit',
}

const contentStyle: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'space-between',
	gap: 24,
}

export const Sheet = memo(
	({ open, onClose, children, height = 471, header, footer }: SheetProps) => {
		const ref = useRef<SheetRef>(null)
		const [adjustedHeight, setAdjustedHeight] = useState(height)

		useResizeVisualViewport(
			({ keyboardHeight, screenHeight }) => {
				if (keyboardHeight > 100) {
					setAdjustedHeight(screenHeight + keyboardHeight)
				} else {
					setAdjustedHeight(height)
				}
			},
			[height],
		)

		return (
			<ModalSheet
				mountPoint={
					typeof document !== 'undefined'
						? document.querySelector('#root')
						: undefined
				}
				ref={ref}
				isOpen={open}
				onClose={onClose}
				className={styles.sheet}
				detent={'content-height'}
				disableDrag={true}
				initialSnap={0}
				snapPoints={[adjustedHeight]}
			>
				<ModalSheet.Container style={containerStyle}>
					<div className={styles.sheet__button} onClick={onClose}>
						<IconX size={20} />
					</div>
					{header && (
						<header className={styles.sheet__header}>
							{header}
						</header>
					)}
					<ModalSheet.Content style={contentStyle}>
						<div>{children}</div>
						{footer && (
							<footer className={styles.sheet__footer}>
								{footer}
							</footer>
						)}
					</ModalSheet.Content>
				</ModalSheet.Container>
			</ModalSheet>
		)
	},
)
