import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { privacyPolicyBlocks } from '~/shared/legal/privacy-policy-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Политика обработки персональных данных — prostoprobuy.pro',
	description: 'Политика в отношении обработки персональных данных и конфиденциальности сервиса prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function PrivacyPolicyPage() {
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
				blocks={privacyPolicyBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.privacy_policy}
			/>
		</div>
	)
}
