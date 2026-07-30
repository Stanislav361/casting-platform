import type { ReactNode } from 'react'
import type { LegalBlock } from './types'
import styles from './legal-document.module.scss'

interface LegalDocumentProps {
	blocks: LegalBlock[]
	version: string
	updatedLabel?: string
}

/**
 * Единый рендерер структурированного текста юридического документа.
 * Используется и на публичных страницах (/legal/agreement, /legal/offer),
 * и внутри экрана принятия документов при входе в приложение.
 */
export default function LegalDocument({ blocks, version, updatedLabel = 'Действующая редакция' }: LegalDocumentProps) {
	let pendingList: string[] = []
	const nodes: ReactNode[] = []

	const flushList = (keyBase: string) => {
		if (pendingList.length === 0) return
		nodes.push(
			<ul className={styles.list} key={`${keyBase}-list`}>
				{pendingList.map((item, i) => (
					<li key={i}>{item.replace(/;\s*$/, '')}</li>
				))}
			</ul>,
		)
		pendingList = []
	}

	blocks.forEach((block, idx) => {
		if (block.type === 'li') {
			pendingList.push(block.text || '')
			return
		}
		flushList(String(idx))

		switch (block.type) {
			case 'title':
				nodes.push(<h1 className={styles.title} key={idx}>{block.text}</h1>)
				break
			case 'h2':
				nodes.push(<h2 className={styles.h2} key={idx}>{block.text}</h2>)
				break
			case 'h3':
				nodes.push(<h3 className={styles.h3} key={idx}>{block.text}</h3>)
				break
			case 'table':
				nodes.push(
					<div className={styles.tableWrap} key={idx}>
						<table className={styles.table}>
							<tbody>
								{(block.rows || []).map((row, ri) => (
									<tr key={ri}>
										{row.map((cell, ci) => (
											<td key={ci}>{cell}</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>,
				)
				break
			default:
				nodes.push(<p className={styles.p} key={idx}>{block.text}</p>)
		}
	})
	flushList('tail')

	return (
		<article className={styles.root}>
			<div className={styles.meta}>
				{updatedLabel}: {version}
			</div>
			{nodes}
		</article>
	)
}
