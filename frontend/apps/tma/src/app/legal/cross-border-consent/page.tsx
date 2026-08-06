import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { crossBorderConsentBlocks } from '~/shared/legal/cross-border-consent-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Согласие на трансграничную передачу персональных данных — prostoprobuy.pro',
	description: 'Согласие на трансграничную передачу персональных данных иностранным получателям (Railway, Telegram, Resend) на Платформе prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function CrossBorderConsentPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<a href="https://prostoprobuy.pro" className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" />
					prosto<span>probuy.pro</span>
				</a>
				<a href="/legal/data-consent" className={styles.switchLink}>Согласие на обработку ПД →</a>
			</div>
			<LegalDocument
				blocks={crossBorderConsentBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.cross_border_consent}
			/>
		</div>
	)
}
