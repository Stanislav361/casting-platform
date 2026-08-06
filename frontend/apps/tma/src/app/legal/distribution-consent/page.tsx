import type { Metadata } from 'next'
import LegalDocument from '~/shared/legal/legal-document'
import { distributionConsentBlocks } from '~/shared/legal/distribution-consent-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Согласие на распространение персональных данных — prostoprobuy.pro',
	description: 'Согласие на обработку персональных данных, разрешённых для распространения, для размещения Анкеты и предоставления Каст-листа на Платформе prostoprobuy.pro.',
	robots: 'index, follow',
}

export default function DistributionConsentPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<a href="https://prostoprobuy.pro" className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" />
					prosto<span>probuy.pro</span>
				</a>
				<a href="/legal/image-consent" className={styles.switchLink}>Согласие на использование фото и видео →</a>
			</div>
			<LegalDocument
				blocks={distributionConsentBlocks}
				version={LEGAL_DOCUMENT_VERSIONS.distribution_consent}
			/>
		</div>
	)
}
