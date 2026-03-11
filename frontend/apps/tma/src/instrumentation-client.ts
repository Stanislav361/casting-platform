import { mockEnv } from '~mock-env'

performance.mark('app-init')

mockEnv().catch(() => {})
