'use client'

import cn from 'classnames'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo } from 'react'

import styles from './index.module.scss'

const styleVariant = {
	default: styles.menu__item__default,
	active: styles.menu__item__active,
	disabled: styles.menu__item__disabled,
}

const AsideMenuItem = memo(
	({ variant = 'default', href, ico, name, actions, disabled }) => {
		const pathname = usePathname()

		return (
			<li className={styles.menu__li} role={'menuitem'}>
				<Link
					href={disabled ? '' : href}
					className={cn(
						styles.menu__item,
						disabled && styles.menu__item__disabled,
						styleVariant[variant],
						(pathname.includes(href) ||
							actions?.map(a => a.href).includes(pathname)) &&
							styles.menu__item__active,
					)}
				>
					<Image
						src={ico}
						unoptimized={true}
						alt={''}
						width={24}
						height={24}
					/>
					{name}
				</Link>
			</li>
		)
	},
)

export default AsideMenuItem
