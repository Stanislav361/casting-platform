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
	IconUsers,
} from '~packages/ui/icons'
import styles from './reports-help.module.scss'

const steps = [
	{
		number: '1',
		title: 'Создайте отчёт',
		text: 'Откройте раздел «Отчёты» и нажмите кнопку «Новый». Выберите кастинг и напишите понятное название отчёта.',
		icon: <IconPlus size={24} />,
		action: 'Отчёты → Новый',
	},
	{
		number: '2',
		title: 'Добавьте актёров',
		text: 'Откройте отчёт. В списке актёров нажмите зелёную галочку в правом верхнем углу карточки. Так актёр попадёт в отчёт.',
		icon: <IconUsers size={24} />,
		action: 'Карточка актёра → Галочка',
	},
	{
		number: '3',
		title: 'Проверьте публичный вид',
		text: 'Нажмите «Публичный вид», чтобы увидеть отчёт глазами режиссёра или заказчика.',
		icon: <IconReport size={24} />,
		action: 'Публичный вид',
	},
	{
		number: '4',
		title: 'Отправьте ссылку',
		text: 'Нажмите «Скопировать ссылку» и отправьте её режиссёру, заказчику или себе в Telegram/WhatsApp.',
		icon: <IconGlobe size={24} />,
		action: 'Скопировать ссылку → Отправить',
	},
]

export default function ReportsHelpPage() {
	const router = useRouter()
	const goBack = useSmartBack('/dashboard/reports')

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<div className={styles.headerTitle}>
					<IconReport size={20} />
					<div>
						<h1>Как сделать отчёт</h1>
						<p>Простая инструкция для заказчика и клиента</p>
					</div>
				</div>
			</header>

			<section className={styles.hero}>
				<div className={styles.heroIcon}><IconReport size={30} /></div>
				<h2>Отчёт — это список актёров, который можно отправить режиссёру</h2>
				<p>
					Вы выбираете нужных актёров, приложение собирает красивую страницу,
					а вы отправляете ссылку человеку, который принимает решение.
				</p>
				<button className={styles.heroBtn} onClick={() => router.push('/dashboard/reports')}>
					Открыть отчёты <IconChevronRight size={16} />
				</button>
			</section>

			<section className={styles.steps}>
				{steps.map((step, index) => (
					<article key={step.number} className={styles.stepCard}>
						<div className={styles.stepTop}>
							<div className={styles.stepNumber}>{step.number}</div>
							<div className={styles.stepIcon}>{step.icon}</div>
						</div>
						<h3>{step.title}</h3>
						<p>{step.text}</p>
						<div className={styles.mock}>
							<span>{step.action}</span>
						</div>
						{index < steps.length - 1 && (
							<div className={styles.arrowDown}>
								<IconChevronRight size={18} />
							</div>
						)}
					</article>
				))}
			</section>

			<section className={styles.visualGuide}>
				<h2>Где что нажимать</h2>
				<div className={styles.visualGrid}>
					<div className={styles.phoneMock}>
						<div className={styles.mockHeader}>
							<IconReport size={16} /> Отчёты
							<span className={styles.mockNew}><IconPlus size={12} /> Новый</span>
						</div>
						<div className={styles.mockLine}>Выберите кастинг</div>
						<div className={styles.mockLine}>Название отчёта</div>
						<div className={styles.mockArrow}>1. Создать отчёт ↑</div>
					</div>
					<div className={styles.phoneMock}>
						<div className={styles.mockHeader}>
							<IconUsers size={16} /> Актёры
						</div>
						<div className={styles.actorMock}>
							<div className={styles.actorPhoto}><IconFilm size={22} /></div>
							<div>
								<b>Имя актёра</b>
								<span>Откликнулся</span>
							</div>
							<div className={styles.actorCheck}><IconCheck size={14} /></div>
						</div>
						<div className={styles.mockArrow}>2. Галочка добавляет в отчёт ↑</div>
					</div>
					<div className={styles.phoneMock}>
						<div className={styles.mockHeader}>
							<IconGlobe size={16} /> Ссылка
						</div>
						<div className={styles.mockButton}>Публичный вид</div>
						<div className={styles.mockButton}>Скопировать ссылку</div>
						<div className={styles.mockArrow}>3. Отправить режиссёру ↑</div>
					</div>
				</div>
			</section>

			<section className={styles.tips}>
				<h2>Коротко для клиента</h2>
				<div className={styles.tipCard}>
					<b>Если отчёт нужен режиссёру</b>
					<p>Добавьте актёров в отчёт → нажмите «Скопировать ссылку» → отправьте ссылку режиссёру.</p>
				</div>
				<div className={styles.tipCard}>
					<b>Если отчёт нужен вам</b>
					<p>Откройте «Публичный вид» и проверьте, как выглядит список. Ссылку можно сохранить себе.</p>
				</div>
				<div className={styles.tipCard}>
					<b>Если актёра нет в отчёте</b>
					<p>Откройте отчёт, найдите актёра и нажмите галочку в правом верхнем углу его карточки.</p>
				</div>
			</section>
		</div>
	)
}
