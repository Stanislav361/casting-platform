'use client'

import data from '@emoji-mart/data'
import { IconMoodSmileBeam } from '@tabler/icons-react'
import dynamic from 'next/dynamic'

import { useToggle } from '@prostoprobuy/hooks'

import styles from './index.module.scss'

const Picker = dynamic(() => import('@emoji-mart/react'), {
	ssr: false,
})

type EmojiSelect = {
	id: string
	keywords: string[]
	name: string
	native: string
	shortcodes: string
	unified: string
}

interface EmojiPickerProps {
	onEmojiSelect: (emoji: EmojiSelect) => void
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
	const [isOpen, toggle] = useToggle(false)

	return (
		<div className={styles.emoji__container}>
			{isOpen && (
				<div className={styles.emoji__box}>
					<Picker
						data={data}
						onEmojiSelect={e => onEmojiSelect(e as EmojiSelect)}
						theme={'light'}
						icons={'outline'}
						locale={'ru'}
						previewPosition={'none'}
						navPosition={'bottom'}
					/>
				</div>
			)}
			<IconMoodSmileBeam
				onClick={toggle}
				className={styles.emoji__icon}
			/>
		</div>
	)
}
