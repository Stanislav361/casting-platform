'use client'

import { ChangeEvent, useEffect, useState } from 'react'

import { fileToBase64 } from '@prostoprobuy/toolkit'
import { Nullable } from '@prostoprobuy/types'

import { useMemoizedFn } from './use-memoized-fn'

type FileParams = {
	name: string
	type: string
	size: number
	lastModified: number
}

export const useFile = () => {
	const [file, setCurrentFile] = useState<Nullable<File>>(null)
	const [params, setParams] = useState<Partial<FileParams>>({})
	const [result, setResult] = useState<string>('')

	useEffect(() => {
		setParams({
			name: file?.name,
			type: file?.type,
			size: file?.size,
			lastModified: file?.lastModified,
		})

		fileToBase64(file, data => {
			setResult(data)
		})
	}, [file])

	const setFile = useMemoizedFn((e: ChangeEvent<HTMLInputElement>) => {
		e.preventDefault()

		if (!e.target.files) return

		const file = e.target?.files[0]

		if (file) {
			setCurrentFile(file)
		}
	})

	const setFiles = useMemoizedFn((files: File[]) => {
		setCurrentFile(files[0])
	})

	const clearFile = useMemoizedFn(() => {
		setCurrentFile(null)
		setParams({})
		setResult('')
	})

	return {
		file,
		clearFile,
		setFile,
		setFiles,
		setResult,
		params,
		result,
	}
}
