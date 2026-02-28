import { ReactNode } from 'react'

import styles from './index.module.scss'

export type Column = {
	id: string
	width: number | string
	text: string
}

export type TableData = {
	[key: string]: string | ReactNode
}

interface TableProps {
	data: TableData[]
	columns: Column[]
}

export const Table = ({ data, columns }: TableProps) => {
	return (
		<div className={styles.table}>
			<div className={styles.header}>
				{columns.map(col => (
					<div
						key={col.id}
						className={styles.cell}
						style={{ width: col.width }}
					>
						{col.text}
					</div>
				))}
			</div>
			<div className={styles.body}>
				{data.map((row, rowIndex) => (
					<div key={rowIndex} className={styles.row}>
						{columns.map(col => (
							<div
								key={col.id}
								className={styles.cell}
								style={{ width: col.width }}
							>
								{row[col.id]}
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	)
}
