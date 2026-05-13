'use client'

import { useRouter } from 'next/navigation'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconCheck,
	IconChevronRight,
	IconFilm,
	IconGlobe,
	IconPlus,
	IconReport,
	IconSend,
	IconUsers,
} from '~packages/ui/icons'
import styles from './reports-help.module.scss'

export default function ReportsHelpPage() {
	const router = useRouter()
	const goBack = useSmartBack('/dashboard/reports')

	return (
		<div className={styles.root}>

			{/* Header */}
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<div className={styles.headerText}>
					<h1>Как работать с отчётами</h1>
					<p>3 простых шага — и ссылка у режиссёра</p>
				</div>
			</header>

			{/* Hero */}
			<section className={styles.hero}>
				<div className={styles.heroIcon}><IconReport size={28} /></div>
				<div>
					<h2>Отчёт — это список актёров для режиссёра</h2>
					<p>
						Вы выбираете нужных актёров, нажимаете одну кнопку и получаете ссылку,
						которую можно отправить кому угодно прямо в мессенджере.
					</p>
				</div>
			</section>

			{/* Steps */}
			<ol className={styles.stepList}>

				{/* Step 1 */}
				<li className={styles.step}>
					<div className={styles.stepLabel}>
						<span className={styles.stepNum}>1</span>
						<h3>Создайте отчёт</h3>
					</div>
					<p className={styles.stepDesc}>
						В разделе <b>«Отчёты»</b> нажмите жёлтую кнопку <b>«+ Новый»</b> в правом верхнем углу.
						Выберите кастинг и напишите название — например, «Шорт-лист Март 2026».
					</p>

					{/* Phone mockup */}
					<div className={styles.phoneMock}>
						<div className={styles.mockTopBar}>
							<span><IconArrowLeft size={12} /> Назад</span>
							<b><IconReport size={12} /> Отчёты</b>
							<span className={styles.mockNewBtn}><IconPlus size={11} /> Новый</span>
						</div>
						<div className={styles.mockModal}>
							<div className={styles.mockModalTitle}>Новый отчёт</div>
							<div className={styles.mockField}>Выберите кастинг ▾</div>
							<div className={styles.mockField}>Название отчёта</div>
							<div className={styles.mockCreateBtn}>Создать</div>
						</div>
						<div className={styles.mockArrowLabel}>
							← нажмите сюда
						</div>
					</div>
				</li>

				<div className={styles.stepArrow}><IconChevronRight size={20} /></div>

				{/* Step 2 */}
				<li className={styles.step}>
					<div className={styles.stepLabel}>
						<span className={styles.stepNum}>2</span>
						<h3>Добавьте актёров</h3>
					</div>
					<p className={styles.stepDesc}>
						Откройте отчёт. В списке актёров найдите нужного и нажмите
						<b> зелёную галочку в правом верхнем углу</b> его карточки.
						Галочка загорается — актёр добавлен.
					</p>

					{/* Phone mockup */}
					<div className={styles.phoneMock}>
						<div className={styles.mockTopBar}>
							<span><IconArrowLeft size={12} /> Отчёты</span>
							<b>Шорт-лист</b>
							<span></span>
						</div>
						<div className={styles.mockTabs}>
							<span className={styles.mockTabActive}>Все</span>
							<span className={styles.mockTab}>Откликнулся</span>
							<span className={styles.mockTab}>В отчёте</span>
						</div>
						<div className={styles.actorGrid}>
							<div className={styles.actorCard}>
								<div className={styles.actorPhoto}>
									<IconFilm size={20} />
								</div>
								<div className={styles.actorCheck} data-active="true">
									<IconCheck size={13} />
								</div>
								<div className={styles.actorName}>Виктория Р.</div>
								<div className={styles.actorBadge} data-green="true">Откликнулась</div>
							</div>
							<div className={styles.actorCard}>
								<div className={styles.actorPhoto}>
									<IconUsers size={20} />
								</div>
								<div className={styles.actorCheck}>
									<IconCheck size={13} />
								</div>
								<div className={styles.actorName}>Артём Н.</div>
								<div className={styles.actorBadge} data-green="true">Откликнулся</div>
							</div>
						</div>
						<div className={styles.mockArrowLabel}>
							↑ нажмите галочку
						</div>
					</div>
				</li>

				<div className={styles.stepArrow}><IconChevronRight size={20} /></div>

				{/* Step 3 */}
				<li className={styles.step}>
					<div className={styles.stepLabel}>
						<span className={styles.stepNum}>3</span>
						<h3>Скопируйте ссылку и отправьте</h3>
					</div>
					<p className={styles.stepDesc}>
						Вернитесь в список отчётов. Нажмите иконку <b>🌐</b> на карточке отчёта —
						ссылка скопируется. Вставьте её в Telegram, WhatsApp или письмо режиссёру.
						<br /><br />
						<b>Ссылка уже публичная</b> — режиссёр откроет её без логина и пароля.
					</p>

					{/* Phone mockup */}
					<div className={styles.phoneMock}>
						<div className={styles.mockTopBar}>
							<span><IconArrowLeft size={12} /> Назад</span>
							<b><IconReport size={12} /> Отчёты</b>
							<span className={styles.mockNewBtn}><IconPlus size={11} /> Новый</span>
						</div>
						<div className={styles.reportCard}>
							<div className={styles.reportCardImg} />
							<div className={styles.reportCardBody}>
								<div className={styles.reportCardTitle}>Шорт-лист Март 2026</div>
								<div className={styles.reportCardMeta}>Актёры через кастинг: 3</div>
								<div className={styles.reportCardActions}>
									<div className={styles.reportActionGlobe}>
										<IconGlobe size={16} />
									</div>
									<div className={styles.reportActionFolder}>
										<IconFilm size={14} />
									</div>
									<div className={styles.reportActionEdit}>
										<IconSend size={14} />
									</div>
								</div>
							</div>
						</div>
						<div className={styles.mockArrowLabelLeft}>
							↑ нажмите 🌐 — ссылка скопирована
						</div>
					</div>
				</li>

			</ol>

			{/* Summary */}
			<section className={styles.summary}>
				<h2>Готово — что происходит дальше</h2>
				<div className={styles.summaryRow}>
					<div className={styles.summaryIcon}><IconGlobe size={20} /></div>
					<div>
						<b>Режиссёр получает ссылку</b>
						<p>Он открывает страницу с фотографиями и данными актёров — без входа в систему.</p>
					</div>
				</div>
				<div className={styles.summaryRow}>
					<div className={styles.summaryIcon}><IconCheck size={20} /></div>
					<div>
						<b>Режиссёр ставит отметки</b>
						<p>Кнопки «Принять» и «Резерв» — прямо на странице отчёта.</p>
					</div>
				</div>
				<div className={styles.summaryRow}>
					<div className={styles.summaryIcon}><IconReport size={20} /></div>
					<div>
						<b>Вы видите отметки в приложении</b>
						<p>Откройте отчёт — там сразу видно кого выбрали, кого в резерв.</p>
					</div>
				</div>
			</section>

			{/* CTA */}
			<button className={styles.ctaBtn} onClick={() => router.push('/dashboard/reports')}>
				Перейти к отчётам <IconChevronRight size={16} />
			</button>

		</div>
	)
}
