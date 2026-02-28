import styles from './index.module.scss'

interface SpinProps {
	size?: 's' | 'm' | 'l'
}

const sizeStyle = {
	s: 12,
	m: 16,
	l: 32,
}

export const Spin = ({ size = 's' }: SpinProps) => {
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
