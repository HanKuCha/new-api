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
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserUsageRow } from '@/features/dashboard/lib/user-usage'
import { api } from '@/lib/api'

import { UserUsageAnalysis } from '../user-usage-analysis'

const longUsername = 'a-complete-long-username-that-must-remain-visible'

function usageRows(): UserUsageRow[] {
  const rows: UserUsageRow[] = Array.from({ length: 22 }, (_, index) => ({
    user_id: index + 1,
    username: index === 0 ? longUsername : `user-${index + 1}`,
    display_name: `Display ${index + 1}`,
    model_name: 'model-a',
    request_count: 1,
    quota: (index + 1) * 100,
    prompt_tokens: 10,
    completion_tokens: 1,
    first_used_at: 100,
    last_used_at: 200,
  }))
  rows.push({
    ...rows[0],
    model_name: 'model-b',
    request_count: 2,
    quota: 900,
    prompt_tokens: 30,
    completion_tokens: 4,
  })
  rows.push({
    ...rows[1],
    model_name: 'free-model',
    quota: 0,
    prompt_tokens: 5,
    completion_tokens: 2,
  })
  return rows
}

function renderAnalysis() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <UserUsageAnalysis />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: usageRows() },
  })
})

describe('user usage analysis', () => {
  it('shows more than ten users and paginates through all users', async () => {
    const user = userEvent.setup()
    renderAnalysis()
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(21)
    expect(within(table).getByText('user-22')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Go to next page' }))
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('user-2')).toBeVisible()
  })

  it('can rank users by input tokens instead of consumption', async () => {
    const user = userEvent.setup()
    renderAnalysis()
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('user-22')
    await user.click(
      within(table).getByRole('button', { name: 'Input Tokens' })
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Desc' }))
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(longUsername)
  })

  it('opens all model usage for the selected user with complete names', async () => {
    const user = userEvent.setup()
    renderAnalysis()
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: longUsername }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName(`Model usage for ${longUsername}`)
    const table = within(dialog).getByRole('table')
    expect(within(table).getByText('model-a')).toBeVisible()
    expect(within(table).getByText('model-b')).toBeVisible()
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filters by model before calculating user totals and keeps free requests', async () => {
    renderAnalysis()
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'free-model' },
    })
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toHaveTextContent('user-2')
    expect(within(rows[1]).getAllByRole('cell')[4]).toHaveTextContent('5')
    expect(within(rows[1]).getAllByRole('cell')[6]).toHaveTextContent('7')
  })

  it('searches usernames, display names and exact user IDs and shows an empty result', async () => {
    renderAnalysis()
    await screen.findByRole('table')
    const search = screen.getByLabelText('Search users')
    fireEvent.change(search, { target: { value: 'Display 22' } })
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(
      2
    )
    expect(within(screen.getByRole('table')).getByText('user-22')).toBeVisible()
    fireEvent.change(search, { target: { value: '1' } })
    expect(
      within(screen.getByRole('table')).getByText(longUsername)
    ).toBeVisible()
    fireEvent.change(search, { target: { value: 'does-not-exist' } })
    expect(screen.queryByText(longUsername)).not.toBeInTheDocument()
    expect(screen.getByText('No Data')).toBeVisible()
  })

  it('shows a retry state on failed queries instead of presenting zero usage', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network failed'))
    renderAnalysis()
    expect(await screen.findByText('Oops! Something went wrong')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
