import styles from './index.module.scss'

export interface SpacerProps {
	v?: 'xss' | 'xs' | 's' | 'm' | 'ml' | 'l' | 'xl' | 'xxl'
}

const styleSpacer = {
	m: styles.spacer,
	xss: styles.spacer__xss,
	xs: styles.spacer__xs,
	s: styles.spacer__s,
	ml: styles.spacer__ml,
	l: styles.spacer__l,
	xl: styles.spacer__xl,
	xxl: styles.spacer__xxl,
}

export const Spacer = ({ v = 'm' }: SpacerProps) => (
	<span className={styleSpacer[v]} />
)
