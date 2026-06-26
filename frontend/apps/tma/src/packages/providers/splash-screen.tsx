'use client'

import { useEffect, useState } from 'react'
import styles from './splash-screen.module.scss'

const FILM_FRAMES_COUNT = 20

function FilmStrip() {
	const frames = Array.from({ length: FILM_FRAMES_COUNT })
	return (
		<div className={styles.filmStrip}>
			<div className={styles.filmTrack}>
				{[...frames, ...frames].map((_, i) => (
					<div key={i} className={styles.filmFrame}>
						<div className={styles.filmHole} />
						<div className={styles.filmHole} />
						<div className={styles.filmHole} />
						<div className={styles.filmHole} />
					</div>
				))}
			</div>
		</div>
	)
}

function Particles() {
	return (
		<div className={styles.particles}>
			{Array.from({ length: 12 }).map((_, i) => (
				<div key={i} className={styles.particle} />
			))}
		</div>
	)
}

export default function SplashScreen() {
	const [hiding, setHiding] = useState(false)
	const [gone, setGone] = useState(false)

	useEffect(() => {
		// Сплэш — чисто косметический. Раньше он висел фиксированные 3.35с на
		// КАЖДОМ старте независимо от готовности приложения — это и был «долгий
		// загрузочный экран». Прячем сразу после монтирования (гидратация
		// прошла), оставляя короткий минимум, чтобы не было резкого мигания.
		const timer = setTimeout(() => setHiding(true), 450)
		const timer2 = setTimeout(() => setGone(true), 950)
		return () => { clearTimeout(timer); clearTimeout(timer2) }
	}, [])

	if (gone) return null

	return (
		<div className={`${styles.splash} ${hiding ? styles.hiding : ''}`}>
			{/* ambient glow bg */}
			<div className={styles.bg} />

			{/* floating golden particles */}
			<Particles />

			{/* corner frame accents */}
			<div className={`${styles.corner} ${styles.tl}`} />
			<div className={`${styles.corner} ${styles.tr}`} />
			<div className={`${styles.corner} ${styles.bl}`} />
			<div className={`${styles.corner} ${styles.br}`} />

			{/* main content */}
			<div className={styles.content}>
				{/* orbit ring + icon */}
				<div className={styles.orbitRing}>
					<div className={styles.ring} />
					<div className={styles.ring2} />
					<div className={styles.scanLine} />
					<div className={styles.iconBadge}>
						<div className={styles.iconWrap}>
							<img
								src="/pwa/icon-512-v3.png"
								alt="prostoprobuy.pro"
								className={styles.iconImage}
							/>
						</div>
					</div>
				</div>

				{/* brand name */}
				<div className={styles.logoText}>
					<div className={styles.brand}>
						prosto<span>probuy.pro</span>
					</div>
					<div className={styles.tagline}>Кастинг-платформа</div>
				</div>

				{/* progress */}
				<div className={styles.progressWrap}>
					<div className={styles.progressBar}>
						<div className={styles.progressFill} />
					</div>
					<div className={styles.progressLabel}>Загрузка</div>
				</div>
			</div>

			{/* film strip at bottom */}
			<FilmStrip />
		</div>
	)
}
