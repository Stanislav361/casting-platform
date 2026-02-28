import { Button } from '~packages/ui'

export const Action = ({
	children,
	width,
	view = 'secondary',
	radius = 'sm',
	selected,
	loading,
	onClick,
	disabled,
	onlyIcon,
	icon,
}: PropsWithAction) => {
	return (
		<Button
			width={width}
			view={view}
			loading={loading}
			radius={radius}
			selected={selected}
			onClick={onClick}
			disabled={disabled}
		>
			{icon}
			{!onlyIcon && children}
		</Button>
	)
}
