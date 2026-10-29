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
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import type { UserUsageSummary } from '@/features/dashboard/lib/user-usage'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'

interface UserUsageTableProps {
  rows: UserUsageSummary[]
  mode: 'users' | 'models'
  onUserSelect?: (user: UserUsageSummary) => void
}

export function UserUsageTable(props: UserUsageTableProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const onUserSelect = props.onUserSelect
  const mode = props.mode
  const columns = useMemo<ColumnDef<UserUsageSummary>[]>(() => {
    const metricLabels = [
      { id: 'quota', title: t('Recorded consumption') },
      { id: 'request_count', title: t('Request count') },
      { id: 'prompt_tokens', title: t('Input Tokens') },
      { id: 'completion_tokens', title: t('Output Tokens') },
      { id: 'total_tokens', title: t('Total Tokens') },
    ] as const
    const metrics = metricLabels.map<ColumnDef<UserUsageSummary>>((metric) => ({
      id: metric.id,
      accessorFn: (row) =>
        metric.id === 'total_tokens'
          ? row.prompt_tokens + row.completion_tokens
          : row[metric.id],
      header: (context) => (
        <DataTableColumnHeader column={context.column} title={metric.title} />
      ),
      cell: (context) =>
        metric.id === 'quota'
          ? formatQuotaWithCurrency(context.getValue<number>(), {
              abbreviate: false,
              digitsLarge: 4,
              digitsSmall: 6,
              locale,
            })
          : formatNumber(context.getValue<number>(), locale),
    }))
    const identity: ColumnDef<UserUsageSummary> = {
      accessorKey: mode === 'users' ? 'username' : 'model_name',
      header: mode === 'users' ? t('User') : t('Model'),
      cell: ({ row }) => {
        const item = row.original
        if (mode === 'models') {
          return (
            <span className='block max-w-96 min-w-48 break-words whitespace-normal'>
              {item.model_name || t('Unknown')}
            </span>
          )
        }
        return (
          <div className='max-w-72 min-w-36 break-words whitespace-normal'>
            <Button
              variant='link'
              className='h-auto max-w-full justify-start p-0 text-left break-all whitespace-normal'
              onClick={() => onUserSelect?.(item)}
            >
              {item.username || `#${item.user_id}`}
            </Button>
            <div className='text-muted-foreground text-xs'>
              {item.display_name} · ID {item.user_id}
            </div>
          </div>
        )
      },
    }
    const result: ColumnDef<UserUsageSummary>[] = [
      {
        id: 'rank',
        header: '#',
        enableSorting: false,
        cell: ({ row, table }) =>
          table
            .getSortedRowModel()
            .rows.findIndex((item) => item.id === row.id) + 1,
      },
      identity,
      ...metrics,
    ]
    if (mode === 'users') {
      result.push({
        accessorKey: 'model_count',
        header: t('Models used'),
        cell: ({ row }) => (
          <Button
            variant='outline'
            size='sm'
            onClick={() => onUserSelect?.(row.original)}
          >
            {formatNumber(row.original.model_count, locale)} · {t('Details')}
          </Button>
        ),
      })
    }
    result.push({
      accessorKey: 'last_used_at',
      header: t('Last used'),
      cell: ({ row }) =>
        dayjs.unix(row.original.last_used_at).format('YYYY-MM-DD HH:mm:ss'),
    })
    return result
  }, [mode, onUserSelect, t, locale])
  const { table } = useDataTable({
    data: props.rows,
    columns,
    initialSorting: [{ id: 'quota', desc: true }],
    initialPagination: { pageIndex: 0, pageSize: 20 },
    columnVisibilityStorageKey: false,
    columnSizingStorageKey: false,
    getRowId: (row) =>
      mode === 'users'
        ? String(row.user_id)
        : row.model_name || 'unknown-model',
  })

  return (
    <div className='space-y-3'>
      <DataTableView table={table} tableClassName='min-w-[1000px]' />
      <DataTablePagination table={table} />
    </div>
  )
}
