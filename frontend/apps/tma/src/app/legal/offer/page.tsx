import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { offerBlocks } from '~/shared/legal/offer-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Публичная оферта — prostoprobuy.pro',
	description: 'Публичная оферта на предоставление платного доступа к функционалу prostoprobuy.pro: тарифы, оплата, автопродление, возврат средств.',
	robots: 'index, follow',
}

export default function PublicOfferPage() {
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
				blocks={offerBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.public_offer}
			/>
		</div>
	)
}
