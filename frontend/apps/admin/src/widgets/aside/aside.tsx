import AsideLogo from './aside-logo'
import AsideMenu from './aside-menu'
import styles from './aside.module.scss'

export default function Aside() {
	return (
		<aside className={styles.aside}>
			<AsideLogo />
			<AsideMenu />
		</aside>
	)
}
