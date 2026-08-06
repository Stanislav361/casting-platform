import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { minorRepresentativeConsentBlocks } from '~/shared/legal/minor-representative-consent-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Согласие законного представителя несовершеннолетнего — prostoprobuy.pro',
	description: 'Согласие законного представителя на обработку персональных данных несовершеннолетнего для создания и ведения Анкеты на Платформе prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function MinorConsentPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<a href="https://prostoprobuy.pro" className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" />
					prosto<span>probuy.pro</span>
				</a>
				<a href="/legal/agent-authority-consent" className={styles.switchLink}>Согласие Актёра Агенту →</a>
			</div>
			<LegalDocument
				blocks={minorRepresentativeConsentBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.minor_representative_consent}
			/>
		</div>
	)
}
