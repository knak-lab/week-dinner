export const GAS_URL = import.meta.env.VITE_GAS_URL || ''
const API_TOKEN = import.meta.env.VITE_API_TOKEN || ''
export const isGasReady = () => Boolean(GAS_URL)

async function get(action, params = {}) {
  if (!GAS_URL) throw new Error('GAS_URLが設定されていません')
  const url = new URL(GAS_URL)
  url.searchParams.set('action', action)
  url.searchParams.set('token', API_TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'API error')
  return json
}

async function post(body) {
  if (!GAS_URL) throw new Error('GAS_URLが設定されていません')
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, token: API_TOKEN }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'API error')
  return json
}

export const gasApi = {
  getWeek:          (weekId) => get('getWeek', { week_id: weekId }),
  getShoppingList:  (weekId) => get('getShoppingList', { week_id: weekId }),

  generateWeek:     (weekId) => post({ action: 'generateWeek', week_id: weekId }),
  setPreference:    (dishName, preference, weekId, dayLabel, variant) =>
    post({ action: 'setPreference', dish_name: dishName, preference, week_id: weekId, day_label: dayLabel, variant }),
  addTag:           (label) => post({ action: 'addTag', label }),
  removeTag:        (tagId) => post({ action: 'removeTag', tag_id: tagId }),
  setCheatDay:      (cheatDay) => post({ action: 'setCheatDay', cheat_day: cheatDay }),
  setChosenVariant: (weekId, dayLabel, variant) => post({ action: 'setChosenVariant', week_id: weekId, day_label: dayLabel, variant }),
}
