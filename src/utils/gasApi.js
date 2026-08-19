export const GAS_URL = import.meta.env.VITE_GAS_URL || ''
const API_TOKEN = import.meta.env.VITE_API_TOKEN || ''
export const isGasReady = () => Boolean(GAS_URL)

const RETRY_DELAYS_MS = [400, 1200]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// GAS Webアプリはレスポンス取得用のリダイレクトを挟むため、モバイル回線などで
// 稀にJSONの代わりにHTML（Googleの中間ページ）が返ってくることがある。
// GETは副作用がないため、パース失敗時に自動で再試行する。
async function parseJsonWithRetry_(fetchFn) {
  let lastError
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetchFn()
      const text = await res.text()
      return JSON.parse(text)
    } catch (e) {
      lastError = e
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  throw new Error('サーバーからの応答を読み取れませんでした。電波状況をご確認のうえ、もう一度お試しください。（' + lastError.message + '）')
}

async function get(action, params = {}) {
  if (!GAS_URL) throw new Error('GAS_URLが設定されていません')
  const url = new URL(GAS_URL)
  url.searchParams.set('action', action)
  url.searchParams.set('token', API_TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const json = await parseJsonWithRetry_(() => fetch(url.toString()))
  if (!json.ok) throw new Error(json.error || 'API error')
  return json
}

async function post(body) {
  if (!GAS_URL) throw new Error('GAS_URLが設定されていません')
  const payload = JSON.stringify({ ...body, token: API_TOKEN })
  // POSTは副作用があるため、レスポンスが得られなかった（fetch自体が失敗した）場合のみ再試行し、
  // レスポンスは届いたがJSONとして読めない場合（＝サーバー側の処理は走った可能性がある）は再試行しない。
  let res
  try {
    res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    })
  } catch (e) {
    await sleep(RETRY_DELAYS_MS[0])
    res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    })
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch (e) {
    throw new Error('サーバーからの応答を読み取れませんでした。通信状況をご確認のうえ、内容が反映されているかもご確認ください。')
  }
  if (!json.ok) throw new Error(json.error || 'API error')
  return json
}

export const gasApi = {
  getWeek:          (weekId) => get('getWeek', { week_id: weekId }),
  getShoppingList:  (weekId) => get('getShoppingList', { week_id: weekId }),
  getStockIngredients: () => get('getStockIngredients'),

  generateWeek:     (weekId) => post({ action: 'generateWeek', week_id: weekId }),
  setPreference:    (dishName, preference, weekId, dayLabel, dishId, kind, recipe, ingredients) =>
    post({ action: 'setPreference', dish_name: dishName, preference, week_id: weekId, day_label: dayLabel, dish_id: dishId, kind, recipe, ingredients }),
  addTag:           (label) => post({ action: 'addTag', label }),
  removeTag:        (tagId) => post({ action: 'removeTag', tag_id: tagId }),
  setCheatDay:      (cheatDay) => post({ action: 'setCheatDay', cheat_day: cheatDay }),
  setChosenDish:    (dishId) => post({ action: 'setChosenDish', dish_id: dishId }),
  addDish:              (weekId, dayLabel, kind, name, recipe, ingredients) =>
    post({ action: 'addDish', week_id: weekId, day_label: dayLabel, kind, name, recipe, ingredients }),
  addDishFromFavorite:  (weekId, dayLabel, favId, kind) =>
    post({ action: 'addDishFromFavorite', week_id: weekId, day_label: dayLabel, fav_id: favId, kind }),
  moveDish:             (dishId, targetDayLabel) =>
    post({ action: 'moveDish', dish_id: dishId, target_day_label: targetDayLabel }),
  addStockIngredient:            (name, quantity) => post({ action: 'addStockIngredient', name, quantity }),
  updateStockIngredientQuantity: (id, quantity) => post({ action: 'updateStockIngredientQuantity', id, quantity }),
  removeStockIngredient:         (id) => post({ action: 'removeStockIngredient', id }),
  checkShoppingItem: (weekId, groupLabel, ingredientName) =>
    post({ action: 'checkShoppingItem', week_id: weekId, group_label: groupLabel, ingredient_name: ingredientName }),
  uncheckShoppingItem: (weekId, groupLabel, ingredientName) =>
    post({ action: 'uncheckShoppingItem', week_id: weekId, group_label: groupLabel, ingredient_name: ingredientName }),
  extractDishFromImage: (images) =>
    post({ action: 'extractDishFromImage', images: images.map((img) => ({ base64: img.base64, mime_type: img.mimeType })) }),
  extractDishFromText: (text) => post({ action: 'extractDishFromText', text }),
  addCandidate: (main, recipe, ingredients, category, thumbnail) =>
    post({
      action: 'addCandidate', main, recipe, ingredients, category,
      image_base64: thumbnail ? thumbnail.base64 : '',
      image_mime_type: thumbnail ? thumbnail.mimeType : '',
    }),
  updateCandidate: (favId, main, recipe, ingredients, category, thumbnail, removeImage) =>
    post({
      action: 'updateCandidate', fav_id: favId, main, recipe, ingredients, category,
      image_base64: thumbnail ? thumbnail.base64 : '',
      image_mime_type: thumbnail ? thumbnail.mimeType : '',
      remove_image: Boolean(removeImage),
    }),
  removeCandidate: (favId) => post({ action: 'removeCandidate', fav_id: favId }),
}
