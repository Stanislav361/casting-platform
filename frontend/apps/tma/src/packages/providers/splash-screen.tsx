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
		const timer = setTimeout(() => setHiding(true), 2600)
		const timer2 = setTimeout(() => setGone(true), 3350)
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
							<svg
								width="36"
								height="36"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<rect x="2" y="2" width="20" height="20" rx="2.18" />
								<line x1="7" y1="2" x2="7" y2="22" />
								<line x1="17" y1="2" x2="17" y2="22" />
								<line x1="2" y1="12" x2="22" y2="12" />
								<line x1="2" y1="7" x2="7" y2="7" />
								<line x1="2" y1="17" x2="7" y2="17" />
								<line x1="17" y1="17" x2="22" y2="17" />
								<line x1="17" y1="7" x2="22" y2="7" />
							</svg>
						</div>
					</div>
				</div>

				{/* brand name */}
				<div className={styles.logoText}>
					<div className={styles.brand}>
						prosto<span>probuy</span>
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
