import { CSSProperties, PropsWithChildren, useMemo } from 'react'

interface ScrollContainerProps extends PropsWithChildren {
	width?: number
	height?: number
}

export function ScrollContainer({
	children,
	width,
	height,
}: ScrollContainerProps) {
	const style: CSSProperties = useMemo(
		() => ({
			position: 'relative',
			overflow: 'hidden',
			overflowY: 'auto',
			scrollbarWidth: 'thin',
			width: width ? `${width}px` : '100%',
			maxHeight: height ? `${height}px` : '100%',
		}),
		[width, height],
	)

	return <div style={style}>{children}</div>
}
