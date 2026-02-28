'use client'

import { useState } from 'react'

import { useMemoizedFn } from './use-memoized-fn'

type CopiedValue = string | null

export function useCopy() {
	const [copiedText, setCopiedText] = useState<CopiedValue>(null)

	const copy = useMemoizedFn(async text => {
		if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
			if (!navigator?.clipboard) {
				console.warn('Clipboard not supported')
				return false
			}

			try {
				await navigator.clipboard.writeText(text)
				setCopiedText(text)
				return true
			} catch (error) {
				console.warn('Copy failed', error)
				setCopiedText(null)
				return false
			}
		}
	})

	return [copiedText, copy]
}
