import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { imageConsentBlocks } from '~/shared/legal/image-consent-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Согласие на использование фото и видео — prostoprobuy.pro',
	description: 'Согласие на использование изображения, фотографий и видеоматериалов в Анкете Актёра на Платформе prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function ImageConsentPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<a href="https://prostoprobuy.pro" className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" />
					prosto<span>probuy.pro</span>
				</a>
				<a href="/legal/agreement" className={styles.switchLink}>Пользовательское соглашение →</a>
			</div>
			<LegalDocument
				blocks={imageConsentBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.image_consent}
			/>
		</div>
	)
}
