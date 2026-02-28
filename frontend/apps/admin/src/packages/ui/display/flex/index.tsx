import {
	CSSProperties,
	ForwardedRef,
	MouseEventHandler,
	MutableRefObject,
	PropsWithChildren,
} from 'react'

interface FlexProps extends PropsWithChildren {
	flexDirection?: CSSProperties['flexDirection']
	flexWrap?: CSSProperties['flexWrap']
	justifyContent?: CSSProperties['justifyContent']
	alignItems?: CSSProperties['alignItems']
	alignContent?: CSSProperties['alignContent']
	flexBasis?: CSSProperties['flexBasis']
	flexGrow?: CSSProperties['flexGrow']
	flex?: CSSProperties['flex']
	flexShrink?: CSSProperties['flexShrink']
	gap?: CSSProperties['gap']
	zIndex?: CSSProperties['zIndex']
	padding?: CSSProperties['padding']
	width?: CSSProperties['width']
	cursor?: CSSProperties['cursor']
	height?: CSSProperties['height']
	onClick?: MouseEventHandler<HTMLDivElement>
	className?: string
	lineHeight?: CSSProperties['lineHeight']
	ref?: ForwardedRef<HTMLDivElement>
}

export const Flex = ({
	children,
	className,
	onClick,
	ref,
	...rest
}: FlexProps) => (
	<div
		className={className}
		onClick={onClick}
		ref={ref}
		style={{
			display: 'flex',
			...rest,
		}}
	>
		{children}
	</div>
)
