const pad = (n) => String(n).padStart(2, '0')

export function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=日 ... 6=土
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function shiftWeekId(weekId, weeks) {
  const [y, m, d] = weekId.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  base.setDate(base.getDate() + weeks * 7)
  return formatDate(mondayOf(base))
}

export function currentWeekId() {
  return formatDate(mondayOf(new Date()))
}
