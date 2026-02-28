'use client'

import cn from 'classnames'
import dynamic from 'next/dynamic'
import { useCallback, useRef } from 'react'
import { QuillOptionsStatic, RangeStatic } from 'react-quill-new'

import { EmojiPicker } from '~packages/lib'
import { Error, Relative, Skeleton } from '~packages/ui'

import styles from './quill.module.scss'
import './quill.snow.scss'

const ReactQuill = dynamic(() => import('react-quill-new'), {
	ssr: false,
	loading: () => <Skeleton height={132} variant={'ellipsis'} />,
})

interface QuillEditorProps {
	value: string
	error?: boolean | string | null
	onChange: (value: string) => void
	placeholder: string
}

export const QUILL_MODULES: QuillOptionsStatic['modules'] = {
	toolbar: [
		['bold', 'italic', 'underline', 'strike'],
		['link', 'clean'],
	],
}

export const QUILL_FORMATS: QuillOptionsStatic['formats'] = [
	'bold',
	'italic',
	'underline',
	'strike',
	'link',
]

export const QuillEditor = ({
	value,
	onChange,
	error,
	placeholder,
}: QuillEditorProps) => {
	const quillRef = useRef<any>(null)

	const handleEmojiSelect = useCallback((nativeEmoji: string) => {
		if (quillRef.current) {
			const quill = quillRef.current.getEditor()
			const range = quill.getSelection()
			const index = range ? range.index : 0
			quill.insertText(index, nativeEmoji, 'user')
			quill.setSelection((index + nativeEmoji.length) as RangeStatic)
			quill.focus()
		}
	}, [])

	return (
		<>
			<Relative>
				<EmojiPicker
					onEmojiSelect={({ native }) => {
						handleEmojiSelect(native)
					}}
				/>
				<ReactQuill
					ref={quillRef}
					className={cn(
						styles.custom__quill,
						error && styles.custom__quill__error,
					)}
					value={value}
					placeholder={placeholder}
					onChange={onChange}
					modules={QUILL_MODULES}
					formats={QUILL_FORMATS}
				/>
			</Relative>
			{error && <Error>{error}</Error>}
		</>
	)
}
