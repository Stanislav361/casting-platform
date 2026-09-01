import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { agreementBlocks } from '~/shared/legal/agreement-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import { PAYMENT_LEGAL_ENABLED } from '~/shared/legal/payment-documents'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Пользовательское соглашение — prostoprobuy.pro',
	description: 'Пользовательское соглашение сервиса prostoprobuy.pro: правила использования Платформы, роли, права и обязанности пользователей.',
	robots: 'index, follow',
}

export default function UserAgreementPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<a href="https://prostoprobuy.pro" className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" />
					prosto<span>probuy.pro</span>
				</a>
				{PAYMENT_LEGAL_ENABLED && (
					<a href="/legal/offer" className={styles.switchLink}>Публичная оферта →</a>
				)}
			</div>
			<LegalDocument
				blocks={agreementBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.user_agreement}
			/>
		</div>
	)
}
