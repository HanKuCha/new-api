/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import {
  FUTABA_GROUP_CAMPAIGN,
  FUTABA_GROUP_LINK,
  isFutabaGroupAnnouncement,
} from '@/lib/futaba-announcement'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationStore } from '@/stores/notification-store'

export function GroupAnnouncementDialog() {
  const { status } = useStatus()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const acknowledgements = useNotificationStore(
    (state) => state.popupAcknowledgements
  )
  const acknowledgePopup = useNotificationStore(
    (state) => state.acknowledgePopup
  )
  const announcement = status?.announcements_enabled
    ? ((status.announcements || []) as Record<string, unknown>[]).find(
        isFutabaGroupAnnouncement
      )
    : undefined
  const key = userId && announcement ? `${FUTABA_GROUP_CAMPAIGN}:${userId}` : ''

  if (!key || acknowledgements.includes(key)) return null

  return <GroupReadingDialog key={key} onRead={() => acknowledgePopup(key)} />
}

function GroupReadingDialog(props: { onRead: () => void }) {
  const { t } = useTranslation()
  const deadline = useRef<number | null>(null)
  const [remaining, setRemaining] = useState(5)

  useEffect(() => {
    deadline.current = performance.now() + 5000
    const timer = window.setInterval(() => {
      setRemaining(
        Math.max(
          0,
          Math.ceil(((deadline.current ?? Infinity) - performance.now()) / 1000)
        )
      )
    }, 100)
    return () => window.clearInterval(timer)
  }, [])

  const close = () => {
    if (deadline.current !== null && performance.now() >= deadline.current) {
      props.onRead()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={t('Station announcement')}
      titleClassName='text-xl font-bold'
      showCloseButton={false}
      initialFocus={false}
      contentClassName='sm:max-w-lg border-0 bg-black text-white ring-0'
      footerClassName='bg-black'
      footer={
        <Button disabled={remaining > 0} onClick={close} className='w-full'>
          {remaining > 0
            ? t('Please read for {{seconds}} seconds', { seconds: remaining })
            : t('I have read, close')}
        </Button>
      }
    >
      <div className='space-y-5 py-4 text-base leading-7'>
        <p className='text-xl font-bold break-words'>
          Futaba中转站qq群：1131618247
        </p>
        <p>
          点击链接加入群聊
          <a
            className='text-primary -mx-1 block rounded px-1 break-all underline underline-offset-4 focus-visible:bg-white/10 focus-visible:outline-none'
            href={FUTABA_GROUP_LINK}
            target='_blank'
            rel='noopener noreferrer'
          >
            {FUTABA_GROUP_LINK}
          </a>
        </p>
      </div>
    </Dialog>
  )
}
