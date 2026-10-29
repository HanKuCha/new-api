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
export const FUTABA_GROUP_CAMPAIGN = 'futaba-qq-20261022-v1'
export const FUTABA_GROUP_NUMBER = '1131618247'
export const FUTABA_GROUP_LINK = 'https://qm.qq.com/q/4HOtOCW2UM'

export function isFutabaGroupAnnouncement(
  item: Record<string, unknown>
): boolean {
  const content = String(item.content || '')
  return (
    content.includes(FUTABA_GROUP_NUMBER) && content.includes(FUTABA_GROUP_LINK)
  )
}
