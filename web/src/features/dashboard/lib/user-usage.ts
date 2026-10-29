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
import { formatNumber } from '@/lib/format'

export function formatUserUsageTokens(
  value: number,
  locale: string | undefined,
  exact: boolean
): string {
  if (exact) return formatNumber(value, locale)
  const scaled = value / 100_000_000
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 })
  if (value > 0 && scaled < 0.0001) return `<${formatter.format(0.0001)}`
  return formatter.format(scaled)
}

export interface UserUsageRow {
  user_id: number
  username: string
  display_name: string
  model_name: string
  request_count: number
  quota: number
  prompt_tokens: number
  completion_tokens: number
  first_used_at: number
  last_used_at: number
}

export interface UserUsageSummary extends UserUsageRow {
  model_count: number
}

export interface UserUsageTimeRange {
  start_timestamp: number
  end_timestamp: number
}

export function aggregateUserUsage(rows: UserUsageRow[]): UserUsageSummary[] {
  const users = new Map<number, UserUsageSummary>()
  for (const row of rows) {
    const current = users.get(row.user_id)
    if (!current) {
      users.set(row.user_id, { ...row, model_name: '', model_count: 1 })
      continue
    }
    current.request_count += row.request_count
    current.quota += row.quota
    current.prompt_tokens += row.prompt_tokens
    current.completion_tokens += row.completion_tokens
    current.model_count += 1
    current.first_used_at = Math.min(current.first_used_at, row.first_used_at)
    current.last_used_at = Math.max(current.last_used_at, row.last_used_at)
  }
  return [...users.values()]
}

export function filterUserUsage(
  rows: UserUsageRow[],
  search: string,
  model: string
): UserUsageRow[] {
  const term = search.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (!model || row.model_name === model) &&
      (!term ||
        row.username.toLowerCase().includes(term) ||
        row.display_name.toLowerCase().includes(term) ||
        String(row.user_id) === term)
  )
}
