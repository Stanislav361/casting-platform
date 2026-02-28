import PublicAsideLogo from './public-aside-logo'
import styles from './public-aside.module.scss'

export default function PublicAside() {
	return (
		<aside className={styles.aside}>
			<PublicAsideLogo />
		</aside>
	)
}
