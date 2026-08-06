import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { agentAuthorityConsentBlocks } from '~/shared/legal/agent-authority-consent-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Согласие Актёра на обработку данных Агентом — prostoprobuy.pro',
	description: 'Согласие Актёра на обработку и передачу персональных данных Агентом для создания и ведения Анкеты на Платформе prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function AgentAuthorityConsentPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<a href="https://prostoprobuy.pro" className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" />
					prosto<span>probuy.pro</span>
				</a>
				<a href="/legal/minor-consent" className={styles.switchLink}>Согласие представителя несовершеннолетнего →</a>
			</div>
			<LegalDocument
				blocks={agentAuthorityConsentBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.agent_authority_consent}
			/>
		</div>
	)
}
