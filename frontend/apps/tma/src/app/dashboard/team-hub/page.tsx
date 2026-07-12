'use client'

import { useRouter } from 'next/navigation'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconChevronRight,
	IconUsers,
	IconBriefcase,
} from '~packages/ui/icons'
import styles from './team-hub.module.scss'

export default function TeamHubPage() {
	const router = useRouter()
	const goBack = useSmartBack('/dashboard')

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Работа в команде</h1>
			</header>

			<div className={styles.subtitle}>
				Выберите раздел: управление своей командой или приглашения в команды других админов.
			</div>

			<div className={styles.choiceGrid}>
				<button className={styles.choiceCard} onClick={() => router.push('/dashboard/team')}>
					<div className={styles.choiceIcon}>
						<IconUsers size={24} />
					</div>
					<div className={styles.choiceBody}>
						<h2>Моя команда</h2>
						<p>Приглашайте админов в свою команду и управляйте их доступом.</p>
					</div>
					<IconChevronRight size={18} />
				</button>

				<button className={styles.choiceCard} onClick={() => router.push('/dashboard/workspace')}>
					<div className={`${styles.choiceIcon} ${styles.choiceIconBlue}`}>
						<IconBriefcase size={24} />
					</div>
					<div className={styles.choiceBody}>
						<h2>Приглашения в команду</h2>
						<p>Команды других админов, куда вас пригласили как коллаборатора.</p>
					</div>
					<IconChevronRight size={18} />
				</button>
			</div>
		</div>
	)
}
