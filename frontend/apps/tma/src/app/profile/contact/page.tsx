import Page from '~widgets/page'
import { ProfileContact, ProfileSteps } from '~widgets/profile'

import { links } from '@prostoprobuy/links'

export default function ProfileContactPage() {
	return (
		<Page back={true} backUrl={links.profile.form}>
			<ProfileSteps />
			<ProfileContact />
		</Page>
	)
}
