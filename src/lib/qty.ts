// Quantities are picked from dropdowns: a unit, then an amount for that unit.
// Solids: g (50, 100, 250, 500) or kg (1-5). Liquids: ml (50, 100, 250, 500) or L (1-5).
// Countable things (eggs, lemons, bread...): Nos (1-12).

export type UnitType = 'solid' | 'liquid' | 'count' | 'any'
export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'Nos'

export const AMOUNTS: Record<Unit, number[]> = {
  g: [50, 100, 250, 500],
  kg: [1, 2, 3, 4, 5],
  ml: [50, 100, 250, 500],
  L: [1, 2, 3, 4, 5],
  Nos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
}

export const UNITS_FOR: Record<UnitType, Unit[]> = {
  solid: ['g', 'kg'],
  liquid: ['ml', 'L'],
  count: ['Nos'],
  any: ['Nos', 'g', 'kg', 'ml', 'L'],
}

export interface Qty {
  amount: number
  unit: Unit
}

export function parseQty(s: string, type: UnitType): Qty {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|L|nos|Nos)$/)
  const allowed = UNITS_FOR[type]
  if (m) {
    const unit = (m[2] === 'l' ? 'L' : m[2] === 'nos' ? 'Nos' : m[2]) as Unit
    const amount = Number(m[1])
    if (allowed.includes(unit)) return { unit, amount: AMOUNTS[unit].includes(amount) ? amount : AMOUNTS[unit][0] }
  }
  const unit = allowed[0]
  return { unit, amount: AMOUNTS[unit][unit === 'g' || unit === 'ml' ? 2 : 0] }
}

export const formatQty = (q: Qty) => `${q.amount} ${q.unit}`
