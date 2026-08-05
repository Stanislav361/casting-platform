import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { dataConsentBlocks } from '~/shared/legal/data-consent-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Согласие на обработку персональных данных — prostoprobuy.pro',
	description: 'Согласие на обработку персональных данных для использования Платформы prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function DataConsentPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<a href="https://prostoprobuy.pro" className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" />
					prosto<span>probuy.pro</span>
				</a>
				<a href="/legal/privacy-policy" className={styles.switchLink}>Политика обработки ПД →</a>
			</div>
			<LegalDocument
				blocks={dataConsentBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.data_processing_consent}
			/>
		</div>
	)
}
