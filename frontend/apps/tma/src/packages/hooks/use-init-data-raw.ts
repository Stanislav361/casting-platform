'use client'

import { initDataRaw, useSignal } from '@telegram-apps/sdk-react'

export const useInitDataRaw = () => useSignal<string>(initDataRaw)
