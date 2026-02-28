import { IconLock } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

import { BodyCard } from '~features/shared'

import { Button } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'

import styles from './access-denied.module.scss'

export const AccessDenied = () => {
	const router = useRouter()

	const onReturn = useMemoizedFn(() => {
		router.replace(links.login)
	})

	return (
		<BodyCard
			icon={
				<div className={styles.accessDeniedIcon}>
					<IconLock size={48} />
				</div>
			}
			title={'Отказано в доступе'}
			description={
				'Для доступа к данной странице требуются права администратора'
			}
		>
			<Button
				onClick={onReturn}
				width={'max'}
				view={'brand'}
				radius={'sm'}
			>
				На страницу входа
			</Button>
		</BodyCard>
	)
}
