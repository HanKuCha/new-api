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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useNotifications } from '@/hooks/use-notifications'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationStore } from '@/stores/notification-store'

import { GroupAnnouncementDialog } from '../group-announcement-dialog'

function NotificationCenter() {
  const notifications = useNotifications()
  return (
    <>
      <output aria-label='Unread notifications'>
        {notifications.unreadCount}
      </output>
      <button
        type='button'
        onClick={() => notifications.openPopover('announcements')}
      >
        Read notifications
      </button>
    </>
  )
}

function renderConsole(
  enabled = true,
  content = 'Futaba中转站qq群：1131618247\n点击链接加入群聊https://qm.qq.com/q/4HOtOCW2UM'
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    announcements_enabled: enabled,
    announcements: [{ id: 1, content }],
  })
  client.setQueryData(['notice'], { success: true, data: '' })
  return render(
    <QueryClientProvider client={client}>
      <NotificationCenter />
      <GroupAnnouncementDialog />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useAuthStore.getState().auth.setUser({ id: 10, username: 'reader', role: 1 })
  useNotificationStore.setState({
    popupAcknowledgements: [],
    readAnnouncementKeys: ['id:1'],
    lastReadNotice: '',
  })
})

afterEach(() => {
  vi.useRealTimers()
})

it('blocks button, Escape and backdrop dismissal before five seconds and keeps the notification unread after closing', async () => {
  renderConsole()
  expect(screen.getByText('Futaba中转站qq群：1131618247')).toBeVisible()
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    'https://qm.qq.com/q/4HOtOCW2UM'
  )
  expect(screen.getByLabelText('Unread notifications')).toHaveTextContent('1')
  const button = screen.getByRole('button', { name: /Please read/ })
  expect(button).toBeDisabled()
  fireEvent.click(button)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  const overlay = document.querySelector(
    '[data-slot=dialog-overlay]'
  ) as HTMLElement
  fireEvent.mouseDown(overlay)
  fireEvent.mouseUp(overlay)
  fireEvent.click(overlay)
  await act(async () => {
    vi.advanceTimersByTime(4900)
  })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(button).toBeDisabled()
  await act(async () => {
    vi.advanceTimersByTime(100)
  })
  const close = screen.getByRole('button', { name: 'I have read, close' })
  expect(close).toBeEnabled()
  fireEvent.click(close)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Unread notifications')).toHaveTextContent('1')
  fireEvent.click(screen.getByRole('button', { name: 'Read notifications' }))
  await act(async () => {
    vi.advanceTimersByTime(1)
  })
  expect(screen.getByLabelText('Unread notifications')).toHaveTextContent('0')
})

it('remembers a completed read after remount and still shows the popup to a different account', async () => {
  const view = renderConsole()
  await act(async () => {
    vi.advanceTimersByTime(5000)
  })
  fireEvent.click(screen.getByRole('button', { name: 'I have read, close' }))
  view.unmount()
  await act(async () => {
    await useNotificationStore.persist.rehydrate()
  })
  renderConsole()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  act(() => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 11, username: 'second-reader', role: 1 })
  })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Please read/ })).toBeDisabled()
})

it('does not display the campaign when announcements are disabled', () => {
  renderConsole(false)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('does not display an unrelated announcement as the group campaign', () => {
  renderConsole(true, 'Service maintenance')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
