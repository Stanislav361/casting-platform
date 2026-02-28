import { CSSProperties, PropsWithChildren } from 'react'

interface GridProps extends PropsWithChildren {
	gap?: CSSProperties['gap']
	columnGap?: CSSProperties['columnGap']
	rowGap?: CSSProperties['rowGap']
	grid?: CSSProperties['grid']
	gridTemplateColumns?: CSSProperties['gridTemplateColumns']
	gridTemplateRows?: CSSProperties['gridTemplateRows']
	alignContent?: CSSProperties['alignContent']
	width?: CSSProperties['width']
	height?: CSSProperties['height']
}

export const Grid = ({ children, ...rest }: GridProps) => {
	return (
		<div
			style={{
				display: 'grid',
				...rest,
			}}
		>
			{children}
		</div>
	)
}
