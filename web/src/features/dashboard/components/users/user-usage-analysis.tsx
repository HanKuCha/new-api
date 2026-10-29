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
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { getUserUsageAnalytics } from '@/features/dashboard/api'
import {
  aggregateUserUsage,
  filterUserUsage,
  type UserUsageSummary,
  type UserUsageTimeRange,
} from '@/features/dashboard/lib/user-usage'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'

import { UserUsageTable } from './user-usage-table'

export function UserUsageAnalysis() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [range, setRange] = useState<UserUsageTimeRange>(() => ({
    start_timestamp: Math.floor(Date.now() / 1000) - 30 * 86400,
    end_timestamp: Math.floor(Date.now() / 1000),
  }))
  const [start, setStart] = useState<Date | undefined>(
    () => new Date(range.start_timestamp * 1000)
  )
  const [end, setEnd] = useState<Date | undefined>(
    () => new Date(range.end_timestamp * 1000)
  )
  const [search, setSearch] = useState('')
  const [model, setModel] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserUsageSummary | null>(
    null
  )
  const query = useQuery({
    queryKey: ['dashboard', 'user-usage-analysis', range],
    queryFn: () => getUserUsageAnalytics(range),
    staleTime: 30_000,
  })
  const rows = useMemo(() => query.data ?? [], [query.data])
  const models = useMemo(
    () =>
      [...new Set(rows.map((row) => row.model_name))].filter(Boolean).sort(),
    [rows]
  )
  const filtered = useMemo(
    () => filterUserUsage(rows, search, model),
    [rows, search, model]
  )
  const users = useMemo(() => aggregateUserUsage(filtered), [filtered])
  const totals = useMemo(
    () =>
      users.reduce(
        (sum, user) => ({
          quota: sum.quota + user.quota,
          requests: sum.requests + user.request_count,
          input: sum.input + user.prompt_tokens,
          output: sum.output + user.completion_tokens,
        }),
        { quota: 0, requests: 0, input: 0, output: 0 }
      ),
    [users]
  )
  const detailRows = useMemo(
    () =>
      filtered
        .filter((row) => row.user_id === selectedUser?.user_id)
        .map((row) => ({ ...row, model_count: 1 })),
    [filtered, selectedUser]
  )
  const invalidRange =
    !end || (start != null && start.getTime() > end.getTime())

  function applyRange() {
    if (invalidRange || !end) return
    setSelectedUser(null)
    setRange({
      start_timestamp: start ? Math.floor(start.getTime() / 1000) : 0,
      end_timestamp: Math.floor(end.getTime() / 1000),
    })
  }

  function selectPreset(days: number) {
    const now = new Date()
    let from: Date | undefined
    if (days === 1) {
      from = new Date(now)
      from.setHours(0, 0, 0, 0)
    } else if (days > 1) {
      from = new Date(now.getTime() - days * 86400000)
    }
    setStart(from)
    setEnd(now)
    setSelectedUser(null)
    setRange({
      start_timestamp: from ? Math.floor(from.getTime() / 1000) : 0,
      end_timestamp: Math.floor(now.getTime() / 1000),
    })
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-4 rounded-lg border p-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='mr-auto font-semibold'>{t('User usage ranking')}</h2>
          <Button variant='outline' size='sm' onClick={() => selectPreset(1)}>
            {t('Today')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => selectPreset(7)}>
            {t('Last 7 days')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => selectPreset(30)}>
            {t('Last 30 days')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => selectPreset(0)}>
            {t('All time')}
          </Button>
        </div>
        <div className='grid items-end gap-3 xl:grid-cols-[1fr_1fr_auto]'>
          <div className='space-y-1.5'>
            <Label>{t('Start time')}</Label>
            <DateTimePicker
              value={start}
              onChange={setStart}
              placeholder={t('All time')}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('End time')}</Label>
            <DateTimePicker value={end} onChange={setEnd} />
          </div>
          <Button
            disabled={invalidRange || query.isFetching}
            onClick={applyRange}
          >
            {t('Apply time range')}
          </Button>
        </div>
        {invalidRange && (
          <p role='alert' className='text-destructive text-sm'>
            {t('Invalid time range')}
          </p>
        )}
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='usage-user-search'>{t('Search users')}</Label>
            <Input
              id='usage-user-search'
              placeholder={t('Username, display name or user ID')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='usage-model-filter'>{t('Model')}</Label>
            <NativeSelect
              id='usage-model-filter'
              className='w-full'
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              <NativeSelectOption value=''>
                {t('All models')}
              </NativeSelectOption>
              {models.map((name) => (
                <NativeSelectOption key={name} value={name}>
                  {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <p className='text-muted-foreground text-xs'>
          {t('Time zone')}: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
      </div>
      {query.isPending && <LoadingState />}
      {query.isError && (
        <ErrorState
          onRetry={() => {
            void query.refetch()
          }}
        />
      )}
      {query.isSuccess && (
        <>
          <div className='grid grid-cols-2 gap-3 lg:grid-cols-6'>
            {[
              { label: t('Users'), value: formatNumber(users.length, locale) },
              {
                label: t('Recorded consumption'),
                value: formatQuotaWithCurrency(totals.quota, {
                  abbreviate: false,
                  digitsLarge: 4,
                  digitsSmall: 6,
                  locale,
                }),
              },
              {
                label: t('Request count'),
                value: formatNumber(totals.requests, locale),
              },
              {
                label: t('Input Tokens'),
                value: formatNumber(totals.input, locale),
              },
              {
                label: t('Output Tokens'),
                value: formatNumber(totals.output, locale),
              },
              {
                label: t('Total Tokens'),
                value: formatNumber(totals.input + totals.output, locale),
              },
            ].map((stat) => (
              <div className='min-w-0 rounded-lg border p-3' key={stat.label}>
                <div className='text-muted-foreground text-xs'>
                  {stat.label}
                </div>
                <div className='mt-2 text-lg font-semibold break-words tabular-nums'>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Click a column heading to sort. Select a user to view model usage.'
            )}
          </p>
          <UserUsageTable
            rows={users}
            mode='users'
            onUserSelect={setSelectedUser}
          />
          <p className='text-muted-foreground text-xs'>
            {t(
              'Statistics use retained consumption logs and recorded charges. Top-ups and refunds are excluded. Input and output tokens follow the logs; cached tokens are not added again.'
            )}
          </p>
        </>
      )}
      <Dialog
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null)
        }}
        title={t('Model usage for {{user}}', {
          user: selectedUser?.username ?? '',
        })}
        description={t(
          'Model usage matches the selected time range and filters.'
        )}
        contentClassName='sm:max-w-6xl'
      >
        <UserUsageTable rows={detailRows} mode='models' />
      </Dialog>
    </div>
  )
}
