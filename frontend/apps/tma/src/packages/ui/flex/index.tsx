import { CSSProperties, PropsWithChildren } from 'react'

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
	width?: CSSProperties['width']
	height?: CSSProperties['height']
	className?: string
	zIndex?: CSSProperties['zIndex']
	onClick?: () => void
	cursor?: CSSProperties['cursor']
	padding?: CSSProperties['padding']
	position?: CSSProperties['position']
	overflow?: CSSProperties['overflow']
}

export const Flex = ({ children, className, onClick, ...rest }: FlexProps) => (
	<div
		style={{
			display: 'flex',
			...rest,
		}}
		className={className ? className : ''}
		onClick={onClick}
	>
		{children}
	</div>
)
