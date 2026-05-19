import { useRef } from 'react'

type SwipeHandlers = {
	onSwipeLeft?: () => void
	onSwipeRight?: () => void
	threshold?: number
}

type SwipeProps = {
	onTouchStart: (e: React.TouchEvent) => void
	onTouchEnd: (e: React.TouchEvent) => void
}

export function useSwipe({
	onSwipeLeft,
	onSwipeRight,
	threshold = 40,
}: SwipeHandlers): SwipeProps {
	const startX = useRef<number | null>(null)
	const startY = useRef<number | null>(null)

	const reset = () => {
		startX.current = null
		startY.current = null
	}

	return {
		onTouchStart: (e) => {
			const t = e.touches[0]
			if (!t) return
			startX.current = t.clientX
			startY.current = t.clientY
		},
		onTouchEnd: (e) => {
			if (startX.current === null || startY.current === null) {
				reset()
				return
			}
			const t = e.changedTouches[0]
			if (!t) {
				reset()
				return
			}
			const dx = t.clientX - startX.current
			const dy = t.clientY - startY.current
			if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
				if (dx < 0) {
					onSwipeLeft?.()
				} else {
					onSwipeRight?.()
				}
			}
			reset()
		},
	}
}
