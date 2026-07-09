'use client'

import { useRouter } from 'next/navigation'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconChat,
	IconChevronRight,
	IconUsers,
	IconMessageSquare,
} from '~packages/ui/icons'
import styles from './chats.module.scss'

export default function ChatsPage() {
	const router = useRouter()
	const goBack = useSmartBack()

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Чаты</h1>
			</header>

			<div className={styles.subtitle}>
				Выберите, куда перейти: в чат своей команды или в общий чат админов.
			</div>

			<div className={styles.choiceGrid}>
				<button className={styles.choiceCard} onClick={() => router.push('/chats/team')}>
					<div className={styles.choiceIcon}>
						<IconUsers size={24} />
					</div>
					<div className={styles.choiceBody}>
						<h2>Чат команды</h2>
						<p>Общение с админами из вашей команды и команд, куда вас пригласили.</p>
					</div>
					<IconChevronRight size={18} />
				</button>

				<button className={styles.choiceCard} onClick={() => router.push('/dashboard/admins-chat')}>
					<div className={`${styles.choiceIcon} ${styles.choiceIconBlue}`}>
						<IconMessageSquare size={24} />
					</div>
					<div className={styles.choiceBody}>
						<h2>Чат админов</h2>
						<p>Общий чат админов, Админ PRO и SuperAdmin.</p>
					</div>
					<IconChevronRight size={18} />
				</button>
			</div>
		</div>
	)
}
