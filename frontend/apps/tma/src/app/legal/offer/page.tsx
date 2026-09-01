import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LegalDocument from '~/shared/legal/legal-document'
import { offerBlocks } from '~/shared/legal/offer-content'
import { LEGAL_DOCUMENT_VERSIONS } from '~/shared/legal/version'
import { PAYMENT_LEGAL_ENABLED } from '~/shared/legal/payment-documents'
import styles from '../legal-page.module.scss'

export const metadata: Metadata = {
	title: 'Публичная оферта — prostoprobuy.pro',
	description: 'Публичная оферта на предоставление платного доступа к функционалу prostoprobuy.pro: тарифы, оплата, автопродление, возврат средств.',
	// Пока платные тарифы не запущены, страница скрыта (см. PAYMENT_LEGAL_ENABLED)
	// и не должна попадать в индекс поисковиков с ценами, которых нет в продаже.
	robots: PAYMENT_LEGAL_ENABLED ? 'index, follow' : 'noindex, nofollow',
}

export default function PublicOfferPage() {
	// Условия оплаты, автопродления и возвратов не должны быть опубликованы,
	// пока платный доступ не продаётся. Текст документа сохранён в
	// offer-content.ts — страница вернётся вместе с оплатой.
	if (!PAYMENT_LEGAL_ENABLED) notFound()

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
