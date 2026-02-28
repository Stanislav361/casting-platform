'use client'

import { useEffect } from 'react'

export const useResizeVisualViewport = (
	callback: ({
		viewportHeight,
		keyboardHeight,
		screenHeight,
	}: {
		viewportHeight: number
		keyboardHeight: number
		screenHeight: number
	}) => void,
	deps: any[],
) => {
	useEffect(() => {
		const originalHeight = window.innerHeight

		const handleResize = () => {
			if (window.visualViewport) {
				const viewportHeight = window.visualViewport.height
				const keyboardHeight = Math.max(
					0,
					originalHeight - viewportHeight,
				)
				const screenHeight = window.innerHeight

				callback({
					viewportHeight,
					keyboardHeight,
					screenHeight,
				})
			}
		}

		window.visualViewport?.addEventListener('resize', handleResize)

		return () =>
			window.visualViewport?.removeEventListener('resize', handleResize)
	}, deps)
}
