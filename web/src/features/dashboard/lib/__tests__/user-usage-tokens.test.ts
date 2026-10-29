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
import { describe, expect, it } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'

import { formatUserUsageTokens } from '../user-usage'

describe('user usage token units', () => {
  it.each(['zhCN', 'zhTW', 'en', 'fr', 'ru', 'ja', 'vi', 'invalid_locale!'])(
    'formats hundred millions and exact tokens with interface language %s',
    (language) => {
      const locale = toIntlLocale(language)
      const decimal = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 4,
      })
      expect(formatUserUsageTokens(123456789, locale, false)).toBe(
        decimal.format(1.2346)
      )
      expect(formatUserUsageTokens(123456789, locale, true)).toBe(
        new Intl.NumberFormat(locale).format(123456789)
      )
    }
  )

  it('keeps zero distinct from tiny positive token usage', () => {
    expect(formatUserUsageTokens(0, 'zh-CN', false)).toBe('0')
    expect(formatUserUsageTokens(1, 'zh-CN', false)).toBe('<0.0001')
    expect(formatUserUsageTokens(9999, 'zh-CN', false)).toBe('<0.0001')
    expect(formatUserUsageTokens(10000, 'zh-CN', false)).toBe('0.0001')
    expect(formatUserUsageTokens(1, 'zh-CN', true)).toBe('1')
  })
})
