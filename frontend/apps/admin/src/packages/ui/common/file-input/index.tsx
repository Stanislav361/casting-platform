'use client'

import { IconX } from '@tabler/icons-react'
import { FC, useCallback, useId, useState } from 'react'

import { Error, Flex, Label } from '~packages/ui'

import { useFile } from '@prostoprobuy/hooks'
import { IMAGE_FILE_TYPES } from '@prostoprobuy/system'
import { formatFileSize } from '@prostoprobuy/toolkit'
import { Nullable } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface FileInputProps {
	file?: Nullable<string>
	onSelect?: (file: Nullable<File>) => void
	error?: string
	label?: string
	accept?: string[]
}

export const FileInput: FC<FileInputProps> = ({
	onSelect,
	file,
	label,
	accept = IMAGE_FILE_TYPES,
	error,
}) => {
	const id = useId()
	const [fileName, setFileName] = useState<Nullable<string>>(file)
	const { result, params, setFile, clearFile } = useFile()

	const handleFileChange = useCallback(
		(e: any) => {
			if (!e.target.files) return

			setFile(e)

			setFileName(null)

			onSelect?.(e.target.files[0])
		},
		[onSelect, setFile],
	)

	const clear = useCallback(() => {
		clearFile()
		setFileName(null)
		onSelect?.(null)
	}, [onSelect, clearFile])

	return (
		<>
			{label && <Label>{label}</Label>}
			<label htmlFor={id} className={styles.file}>
				<input
					id={id}
					type='file'
					name={id}
					accept={accept}
					onChange={handleFileChange}
					hidden={true}
					multiple={false}
				/>
				<span>{fileName ? fileName : 'Выберите изображение'}</span>
				<div>Загрузить</div>
			</label>
			{error && <Error>{error}</Error>}
			{result && (
				<div className={styles.filePreview}>
					<Flex gap={8} alignItems={'center'}>
						<img src={result} alt={''} />
						<Flex flexDirection={'column'}>
							<span>{params.name}</span>
							<p>{formatFileSize(params.size)}</p>
						</Flex>
					</Flex>
					<IconX
						size={26}
						onClick={clear}
						color={'var(--color-grey)'}
					/>
				</div>
			)}
		</>
	)
}
