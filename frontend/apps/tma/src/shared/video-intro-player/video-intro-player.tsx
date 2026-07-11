'use client'

import { getVideoPlayback, type VideoPlayback } from '~/shared/video-link'
import styles from './video-intro-player.module.scss'

type VideoIntroPlayerProps = {
	src?: string | null
	poster?: string | null
	title?: string
	className?: string
}

export function VideoIntroPlayer({
	src,
	poster,
	title = 'Видеовизитка',
	className = '',
}: VideoIntroPlayerProps) {
	const playback = getVideoPlayback(src, { poster, label: title })
	if (!playback) return null

	return (
		<div className={`${styles.root} ${className}`.trim()}>
			<div className={styles.player}>
				<PlaybackWindow playback={playback} title={title} />
			</div>
			<div className={styles.caption}>
				<strong>{title}</strong>
				<span>{playback.type === 'external' ? 'Откроется на внешнем сайте' : playback.label}</span>
			</div>
		</div>
	)
}

function PlaybackWindow({ playback, title }: { playback: VideoPlayback; title: string }) {
	if (playback.type === 'direct') {
		return (
			<video
				className={styles.media}
				src={playback.src}
				poster={playback.poster || undefined}
				controls
				playsInline
				preload="metadata"
			>
				Ваш браузер не поддерживает воспроизведение видео.
			</video>
		)
	}

	if (playback.type === 'embed') {
		return (
			<iframe
				className={styles.media}
				src={playback.src}
				title={title}
				loading="lazy"
				allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
				referrerPolicy="strict-origin-when-cross-origin"
				allowFullScreen
			/>
		)
	}

	return (
		<a
			className={styles.external}
			href={playback.src}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`Открыть ${title.toLowerCase()}`}
		>
			<span className={styles.playIcon} aria-hidden="true" />
			<strong>Запустить видеовизитку</strong>
			<small>{playback.label}</small>
		</a>
	)
}
