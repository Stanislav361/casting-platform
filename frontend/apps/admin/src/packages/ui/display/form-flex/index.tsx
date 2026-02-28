import { FC, PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const FormFlex = ({ children }: PropsWithChildren) => (
	<div className={styles.form__flex}>{children}</div>
)
