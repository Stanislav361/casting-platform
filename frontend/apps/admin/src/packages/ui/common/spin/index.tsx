import styles from './index.module.scss'

interface SpinProps {
	size?: Size
}

const sizeStyle = {
	sm: 22,
	md: 32,
	lg: 44,
}

export const Spin = ({ size = 'md' }: SpinProps) => {
	return (
		<span className={styles.spinWrapper}>
			<span
				className={styles.spin}
				style={{
					width: sizeStyle[size],
					height: sizeStyle[size],
				}}
			></span>
		</span>
	)
}
