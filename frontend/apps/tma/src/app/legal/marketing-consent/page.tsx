import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { marketingConsentBlocks } from '~/shared/legal/marketing-consent-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Согласие на рекламные рассылки — prostoprobuy.pro',
	description: 'Согласие на получение рекламных и информационно-рекламных сообщений от Платформы prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function MarketingConsentPage() {
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
				blocks={marketingConsentBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.marketing_consent}
			/>
		</div>
	)
}
