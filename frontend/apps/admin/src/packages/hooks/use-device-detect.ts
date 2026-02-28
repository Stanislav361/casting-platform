'use client'

import { useMediaQuery } from 'react-responsive'

export const useDeviceDetect = () => {
	const isMobile = useMediaQuery({ query: '(max-width: 767px)' })
	const isTablet = useMediaQuery({
		query: '(min-width: 768px) and (max-width: 1024px)',
	})
	const isLaptop = useMediaQuery({ query: '(max-width: 1200px)' })
	const isDesktop = useMediaQuery({ query: '(min-width: 1025px)' })

	const isPortrait = useMediaQuery({ query: '(orientation: portrait)' })
	const isLandscape = useMediaQuery({ query: '(orientation: landscape)' })

	const userAgent =
		typeof window !== 'undefined' && typeof navigator !== 'undefined'
			? navigator.userAgent
			: ''
	const isIOS = /ios|iPad|iPhone|iPod/.test(userAgent)
	const isAndroid = /android/i.test(userAgent)
	const isWindows = /win|windows/i.test(userAgent)
	const isMacOS = /mac|macintosh/i.test(userAgent)
	const isLinux = /linux/i.test(userAgent)

	return {
		isMobile,
		isTablet,
		isDesktop,
		isLaptop,
		isPortrait,
		isLandscape,
		isIOS,
		isAndroid,
		isWindows,
		isMacOS,
		isLinux,
	}
}
