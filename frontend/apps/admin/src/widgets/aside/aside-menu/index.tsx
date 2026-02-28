import { useMenu } from '~widgets/aside/hooks'

import AsideMenuItem from './aside-menu-item'
import styles from './index.module.scss'

const AsideMenu = () => {
	const menu = useMenu()

	return (
		<menu className={styles.menu} role={'menu'}>
			{menu.map((e, i) => (
				<AsideMenuItem key={i} {...e} />
			))}
		</menu>
	)
}

export default AsideMenu
