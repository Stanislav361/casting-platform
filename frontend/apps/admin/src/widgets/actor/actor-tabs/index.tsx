import { Tab, TabList } from '~packages/ui'

export type ActorTab = 'about' | 'responses'

export interface ActorTabsProps {
	tab: ActorTab
	setTab: (tab: ActorTab) => void
}

export default function ActorTabs({ tab, setTab }: ActorTabsProps) {
	return (
		<TabList>
			<Tab selected={tab === 'about'} onUpdate={() => setTab('about')}>
				Основная информация
			</Tab>
			<Tab
				selected={tab === 'responses'}
				onUpdate={() => setTab('responses')}
			>
				Отклики
			</Tab>
		</TabList>
	)
}
