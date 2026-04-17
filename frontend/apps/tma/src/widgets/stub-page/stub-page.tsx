'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { IconCheck, IconArrowLeft } from '~packages/ui/icons'
import styles from './stub-page.module.scss'

interface StubPageProps {
	icon: ReactNode
	title: string
	description: string
	features: string[]
	accentColor?: string
	backHref?: string
}

export default function StubPage({
	icon,
	title,
	description,
	features,
	accentColor = 'var(--c-gold)',
	backHref,
}: StubPageProps) {
	const router = useRouter()

	return (
		<div className={styles.root}>
			<div className={styles.card} style={{ '--accent': accentColor } as React.CSSProperties}>
				<div className={styles.iconWrap}>{icon}</div>

				<h1 className={styles.title}>{title}</h1>
				<p className={styles.description}>{description}</p>

				<div className={styles.badge}>В разработке</div>

				{features.length > 0 && (
					<div className={styles.featuresBox}>
						<p className={styles.featuresTitle}>Что здесь появится</p>
						<ul className={styles.featuresList}>
							{features.map((feature, idx) => (
								<li key={idx} className={styles.featureItem}>
									<span className={styles.featureDot}>
										<IconCheck size={11} />
									</span>
									<span>{feature}</span>
								</li>
							))}
						</ul>
					</div>
				)}

				<button className={styles.backBtn} onClick={() => (backHref ? router.push(backHref) : router.back())}>
					<IconArrowLeft size={14} />
					Назад
				</button>
			</div>
		</div>
	)
}
