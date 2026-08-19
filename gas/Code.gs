// =============================================================
//  週の晩ごはん — Google Apps Script API
// =============================================================

const SPREADSHEET_ID = '1msjKZ1gpog3igLrI5LLHsTKzp4bNAjRNPmGX5XdnZHQ'

const WEEK_SHEET  = 'WeekPlan'
const WEEK_HDR    = ['week_id', 'day_label', 'date', 'cheat', 'tags']
const DISH_SHEET  = 'WeekDishes'
const DISH_HDR    = ['week_id', 'day_label', 'dish_id', 'order', 'kind', 'name', 'recipe', 'chosen', 'image_url']
const ING_SHEET    = 'Ingredients'
const ING_HDR      = ['week_id', 'day_label', 'dish_id', 'ingredient_name', 'amount', 'note']
const TAG_SHEET    = 'StyleTags'
const TAG_HDR      = ['tag_id', 'label', 'created_at']
const PREF_SHEET  = 'Preferences'
const PREF_HDR    = ['dish_name', 'preference', 'week_id', 'day_label', 'dish_id', 'updated_at']
const CHEAT_SHEET = 'CheatDaySetting'
const CHEAT_HDR   = ['cheat_day']
const STOCK_SHEET  = 'StockIngredients'
const STOCK_HDR    = ['id', 'name', 'quantity', 'updated_at']
const CHECKED_SHEET = 'CheckedShoppingItems'
const CHECKED_HDR   = ['week_id', 'group_label', 'ingredient_name', 'checked_at']
const FAV_SHEET    = 'FavoriteDishes'
const FAV_HDR      = ['fav_id', 'main', 'side', 'recipe', 'ingredients_json', 'created_at', 'image_url', 'category']

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const SHOPPING_GROUPS = [['月', '火', '水'], ['木', '金', '土'], ['日']]

// ─────────────────────────────────────────
//  食材カテゴリ分類（買い物リスト・手持ち食材の「肉・野菜・調味料」振り分け）
// ─────────────────────────────────────────

const INGREDIENT_CATEGORY_ORDER = ['肉', '野菜', '調味料', 'その他']
const INGREDIENT_CATEGORY_KEYWORDS = {
  '肉': [
    '鶏', '豚', '牛', 'ひき肉', '挽き肉', 'ベーコン', 'ハム', 'ソーセージ', 'ウインナー',
    '手羽', '肉', 'ミンチ',
  ],
  '野菜': [
    '玉ねぎ', 'たまねぎ', 'にんじん', '人参', 'じゃがいも', 'ジャガイモ', 'さつまいも', 'キャベツ',
    '白菜', '大根', 'ほうれん草', '小松菜', 'ピーマン', 'パプリカ', 'きゅうり', 'トマト', 'なす',
    'ナス', 'かぼちゃ', 'カボチャ', 'ねぎ', 'ネギ', 'もやし', 'きのこ', 'しめじ', 'えのき',
    'しいたけ', 'シイタケ', '舞茸', 'マイタケ', 'エリンギ', 'ごぼう', 'れんこん', 'レンコン',
    'ブロッコリー', 'アスパラ', 'レタス', 'セロリ', 'にんにく', 'ニンニク', '生姜', 'しょうが',
    'ショウガ', 'オクラ', 'ズッキーニ', 'アボカド', '豆苗', '水菜', 'かぶ', 'カブ', '枝豆',
    'とうもろこし', 'コーン', 'チンゲン菜', 'パセリ', '三つ葉', 'みょうが', '大葉', 'しそ', 'ゴーヤ',
  ],
  '調味料': [
    '醤油', 'しょうゆ', '味噌', 'みそ', '砂糖', '塩', 'こしょう', '胡椒', '酢', 'みりん',
    '料理酒', '酒', '油', 'だし', '出汁', 'ガラスープ', 'スープの素', 'コンソメ', 'ケチャップ',
    'マヨネーズ', 'ソース', 'たれ', 'ポン酢', 'めんつゆ', 'ラー油', '豆板醤', 'オイスターソース',
    'カレー粉', '片栗粉', '小麦粉', 'パン粉', 'バター', 'はちみつ', 'ハチミツ', 'ごま', 'ゴマ',
    '唐辛子', 'わさび', 'からし', '七味', '山椒', 'クミン', '塩こしょう', 'にんにくチューブ',
    '生姜チューブ',
  ],
}

// 「鶏ガラスープの素」のような複合語は調味料の判定を優先する
const INGREDIENT_CATEGORY_PRIORITY = ['調味料', '肉', '野菜']

function categorizeIngredient_(name) {
  const n = String(name || '')
  for (let i = 0; i < INGREDIENT_CATEGORY_PRIORITY.length; i++) {
    const cat = INGREDIENT_CATEGORY_PRIORITY[i]
    if (INGREDIENT_CATEGORY_KEYWORDS[cat].some(k => n.indexOf(k) !== -1)) return cat
  }
  return 'その他'
}

// ─────────────────────────────────────────
//  ルーティング
// ─────────────────────────────────────────

function isAuthorized(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN')
  return Boolean(expected) && token === expected
}

function doGet(e) {
  if (!isAuthorized(e.parameter.token)) return err('Unauthorized')
  const action = e.parameter.action || ''
  try {
    ensureDishSchemaMigrated_()
    ensureDriveUrlsMigrated_()
    switch (action) {
      case 'getWeek':              return ok(getWeek(e.parameter.week_id || ''))
      case 'getShoppingList':      return ok(getShoppingList(e.parameter.week_id || ''))
      case 'getStockIngredients':  return ok({ ingredients: getStockIngredients() })
      default:                     return err('Unknown action: ' + action)
    }
  } catch (ex) {
    return err(ex.message)
  }
}

function doPost(e) {
  try {
    const raw  = e.parameter.data || e.postData.contents
    const body = JSON.parse(raw)
    if (!isAuthorized(body.token)) return err('Unauthorized')
    ensureDishSchemaMigrated_()
    ensureDriveUrlsMigrated_()
    switch (body.action) {
      case 'generateWeek':     return ok(generateWeek(body.week_id))
      case 'setPreference':    return ok(setPreference(body.dish_name, body.preference, body.week_id, body.day_label, body.dish_id, body.kind, body.recipe, body.ingredients))
      case 'addTag':           return ok(addTag(body.label))
      case 'removeTag':        return ok(removeTag(body.tag_id))
      case 'setCheatDay':      return ok(setCheatDay(body.cheat_day))
      case 'setChosenDish':    return ok(setChosenDish(body.dish_id))
      case 'addDish':              return ok(addDish(body.week_id, body.day_label, body.kind, body.name, body.recipe, body.ingredients, body.image_url))
      case 'addDishFromFavorite':  return ok(addDishFromFavorite(body.week_id, body.day_label, body.fav_id, body.kind))
      case 'moveDish':              return ok(moveDish(body.dish_id, body.target_day_label))
      case 'addStockIngredient':             return ok(addStockIngredient(body.name, body.quantity))
      case 'updateStockIngredientQuantity':  return ok(updateStockIngredientQuantity(body.id, body.quantity))
      case 'removeStockIngredient':          return ok(removeStockIngredient(body.id))
      case 'checkShoppingItem':              return ok(checkShoppingItem(body.week_id, body.group_label, body.ingredient_name))
      case 'uncheckShoppingItem':            return ok(uncheckShoppingItem(body.week_id, body.group_label, body.ingredient_name))
      case 'extractDishFromImage':           return ok(extractDishFromImage(body.images))
      case 'extractDishFromText':            return ok(extractDishFromText(body.text))
      case 'addCandidate':                   return ok(addCandidate(body.main, body.recipe, body.ingredients, body.category, body.image_base64, body.image_mime_type))
      case 'updateCandidate':                return ok(updateCandidate(body.fav_id, body.main, body.recipe, body.ingredients, body.category, body.image_base64, body.image_mime_type, body.remove_image))
      case 'removeCandidate':                return ok(removeCandidate(body.fav_id))
      default:                 return err('Unknown action: ' + body.action)
    }
  } catch (ex) {
    return err(ex.message)
  }
}

// ─────────────────────────────────────────
//  レスポンスヘルパー
// ─────────────────────────────────────────

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON)
}

function err(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─────────────────────────────────────────
//  シート共通ユーティリティ
// ─────────────────────────────────────────

let _ss = null
function getSpreadsheet_() {
  if (!_ss) _ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  return _ss
}

function openOrCreateSheet_(name, hdr) {
  const ss = getSpreadsheet_()
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.appendRow(hdr)
    sheet.setFrozenRows(1)
    const r = sheet.getRange(1, 1, 1, hdr.length)
    r.setBackground('#E8F0FE')
    r.setFontColor('#003087')
    r.setFontWeight('bold')
    return sheet
  }
  // 既存シートにヘッダーの追加列があれば末尾に補う（後から増えた列に対応。既存列の削除・リネームはしない）
  const lastCol = sheet.getLastColumn()
  const existingHdr = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : []
  const missing = hdr.filter(h => existingHdr.indexOf(h) === -1)
  if (missing.length > 0) {
    sheet.getRange(1, existingHdr.length + 1, 1, missing.length).setValues([missing])
  }
  return sheet
}

function cellToStr(val) {
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val ?? '')
}

function sheetToObjs_(sheet) {
  const data = sheet.getDataRange().getValues()
  if (data.length <= 1) return []
  const hdrs = data[0]
  return data.slice(1)
    .filter(r => r.some(c => c !== '' && c !== null))
    .map(r => { const o = {}; hdrs.forEach((h, i) => { o[h] = cellToStr(r[i]) }); return o })
}

function appendRow_(sheet, hdr, obj) {
  sheet.appendRow(hdr.map(col => obj[col] !== undefined ? obj[col] : ''))
}

function nowStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
}

function shuffle_(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─────────────────────────────────────────
//  WeekDishes 互換マイグレーション
//  旧形式（main列・side列で主菜副菜を1行にまとめていた）が残っていたら、
//  新形式（kind列・name列で主菜/副菜を別行にする）に自動変換する。
//  変換後は物理シートのヘッダーが新形式になるため以降は即スキップされる（冪等）。
// ─────────────────────────────────────────
function ensureDishSchemaMigrated_() {
  const ss = getSpreadsheet_()
  const sheet = ss.getSheetByName(DISH_SHEET)
  if (!sheet) return
  const lastCol = sheet.getLastColumn()
  if (lastCol === 0) return
  const hdr = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
  if (hdr.indexOf('main') === -1 && hdr.indexOf('side') === -1) return

  const oldRows = sheetToObjs_(sheet)

  const splitRecipe_ = (recipe) => {
    const text = recipe || ''
    const mainMatch = text.match(/【主菜】\n([\s\S]*?)(?:\n\n【副菜】|$)/)
    const sideMatch = text.match(/【副菜】\n([\s\S]*)$/)
    if (mainMatch || sideMatch) {
      return { main: mainMatch ? mainMatch[1].trim() : '', side: sideMatch ? sideMatch[1].trim() : '' }
    }
    return { main: text, side: '' }
  }

  const newRows = []
  oldRows.forEach(r => {
    const parts = splitRecipe_(r.recipe)
    if (r.main) newRows.push([r.week_id, r.day_label, r.dish_id, r.order, 'main', r.main, parts.main, r.chosen, r.image_url || ''])
    if (r.side) newRows.push([r.week_id, r.day_label, Utilities.getUuid(), r.order, 'side', r.side, parts.side, r.chosen, ''])
  })

  sheet.clear()
  sheet.appendRow(DISH_HDR)
  sheet.setFrozenRows(1)
  const headerRange = sheet.getRange(1, 1, 1, DISH_HDR.length)
  headerRange.setBackground('#E8F0FE')
  headerRange.setFontColor('#003087')
  headerRange.setFontWeight('bold')
  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, DISH_HDR.length).setValues(newRows)
  }
}

// ─────────────────────────────────────────
//  旧形式のDrive画像URL（drive.google.com/uc?id=...）を、ブラウザの<img>埋め込みで
//  CORPブロックされない thumbnailエンドポイント形式に一括修正する（冪等）。
// ─────────────────────────────────────────
function ensureDriveUrlsMigrated_() {
  const fixSheet = (sheetName) => {
    const sheet = getSpreadsheet_().getSheetByName(sheetName)
    if (!sheet) return
    const lastCol = sheet.getLastColumn()
    if (lastCol === 0) return
    const hdrRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    const colIdx = hdrRow.indexOf('image_url')
    if (colIdx === -1) return
    const lastRow = sheet.getLastRow()
    if (lastRow < 2) return
    const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1)
    const values = range.getValues()
    let changed = false
    const updated = values.map(row => {
      const val = String(row[0] || '')
      const m = val.match(/drive\.google\.com\/uc\?id=([^&]+)/)
      if (!m) return [val]
      changed = true
      return [driveThumbnailUrl_(m[1])]
    })
    if (changed) range.setValues(updated)
  }
  fixSheet(FAV_SHEET)
  fixSheet(DISH_SHEET)
}

// ─────────────────────────────────────────
//  週の献立（WeekPlan＝曜日メタ情報 / WeekDishes＝献立候補 / Ingredients）
// ─────────────────────────────────────────

function getWeek(weekId) {
  const dayMetaRows = sheetToObjs_(openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)).filter(r => r.week_id === weekId)
  const dishRows    = sheetToObjs_(openOrCreateSheet_(DISH_SHEET, DISH_HDR)).filter(r => r.week_id === weekId)
  const ingredients = sheetToObjs_(openOrCreateSheet_(ING_SHEET, ING_HDR)).filter(r => r.week_id === weekId)

  const dishesByDay = {}
  dishRows.forEach(d => {
    if (!dishesByDay[d.day_label]) dishesByDay[d.day_label] = []
    dishesByDay[d.day_label].push(d)
  })
  Object.keys(dishesByDay).forEach(day => {
    dishesByDay[day].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'main' ? -1 : 1
      return Number(a.order) - Number(b.order)
    })
  })

  const weekPlan = dayMetaRows
    .slice()
    .sort((a, b) => DAY_LABELS.indexOf(a.day_label) - DAY_LABELS.indexOf(b.day_label))
    .map(meta => ({
      day_label: meta.day_label,
      date: meta.date,
      cheat: meta.cheat,
      tags: meta.tags,
      dishes: dishesByDay[meta.day_label] || [],
    }))

  return {
    weekPlan,
    ingredients,
    styleTags:   getStyleTags(),
    preferences: sheetToObjs_(openOrCreateSheet_(PREF_SHEET, PREF_HDR)),
    favorites:   getFavorites(),
    cheatDay:    getCheatDay(),
  }
}

function clearWeekRows_(sheet, hdr, weekId) {
  const data = sheet.getDataRange().getValues()
  const weekIdx = hdr.indexOf('week_id')
  for (let i = data.length - 1; i >= 1; i--) {
    if (cellToStr(data[i][weekIdx]) === weekId) sheet.deleteRow(i + 1)
  }
}

// ─────────────────────────────────────────
//  曜日メタ情報（日付・チートデイ・タグ）
// ─────────────────────────────────────────

function ensureDayMeta_(weekId, dayLabel) {
  const sheet = openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)
  const data  = sheet.getDataRange().getValues()
  const weekIdx = WEEK_HDR.indexOf('week_id')
  const dayIdx  = WEEK_HDR.indexOf('day_label')
  for (let i = 1; i < data.length; i++) {
    if (cellToStr(data[i][weekIdx]) === weekId && String(data[i][dayIdx]) === dayLabel) return
  }
  const dayOrder = DAY_LABELS.indexOf(dayLabel)
  const date = dayOrder >= 0 ? buildWeekDates_(weekId)[dayOrder] : ''
  appendRow_(sheet, WEEK_HDR, { week_id: weekId, day_label: dayLabel, date, cheat: false, tags: '' })
}

function setDayNotCheat_(weekId, dayLabel) {
  const sheet = openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)
  const data  = sheet.getDataRange().getValues()
  const weekIdx  = WEEK_HDR.indexOf('week_id')
  const dayIdx   = WEEK_HDR.indexOf('day_label')
  const cheatIdx = WEEK_HDR.indexOf('cheat')
  for (let i = 1; i < data.length; i++) {
    if (cellToStr(data[i][weekIdx]) === weekId && String(data[i][dayIdx]) === dayLabel) {
      sheet.getRange(i + 1, cheatIdx + 1).setValue(false)
      return
    }
  }
}

// ─────────────────────────────────────────
//  献立候補（WeekDishes）の追加・移動・選択
// ─────────────────────────────────────────

function nextDishOrder_(dishSheet, weekId, dayLabel, kind) {
  const rows = sheetToObjs_(dishSheet).filter(r => r.week_id === weekId && r.day_label === dayLabel && r.kind === kind)
  if (rows.length === 0) return 0
  return Math.max.apply(null, rows.map(r => Number(r.order) || 0)) + 1
}

function saveDishIngredients_(weekId, dayLabel, dishId, ingredients) {
  const ingSheet = openOrCreateSheet_(ING_SHEET, ING_HDR)
  ;(ingredients || []).forEach(ing => {
    if (ing && ing.name) appendRow_(ingSheet, ING_HDR, { week_id: weekId, day_label: dayLabel, dish_id: dishId, ingredient_name: ing.name, amount: ing.amount || '', note: ing.note || '' })
  })
}

function addDish(weekId, dayLabel, kind, name, recipe, ingredients, imageUrl) {
  if (!weekId || !dayLabel) return { error: 'week_id and day_label are required' }
  if (!name) return { error: 'name is required' }
  const normKind = kind === 'side' ? 'side' : 'main'

  ensureDayMeta_(weekId, dayLabel)
  setDayNotCheat_(weekId, dayLabel)

  const dishSheet = openOrCreateSheet_(DISH_SHEET, DISH_HDR)
  const dishId = Utilities.getUuid()
  const order  = nextDishOrder_(dishSheet, weekId, dayLabel, normKind)
  appendRow_(dishSheet, DISH_HDR, {
    week_id: weekId, day_label: dayLabel, dish_id: dishId, order,
    kind: normKind, name, recipe: recipe || '', chosen: '', image_url: imageUrl || '',
  })
  saveDishIngredients_(weekId, dayLabel, dishId, ingredients)

  return getWeek(weekId)
}

function addDishFromFavorite(weekId, dayLabel, favId, kind) {
  if (!favId) return { error: 'fav_id is required' }
  const fav = getFavorites().find(f => f.fav_id === favId)
  if (!fav) return { error: 'favorite not found' }
  let ingredients = []
  try { ingredients = JSON.parse(fav.ingredients_json || '[]') } catch (ex) { ingredients = [] }
  return addDish(weekId, dayLabel, kind, fav.main, fav.recipe, ingredients, fav.image_url)
}

function moveDish(dishId, targetDayLabel) {
  if (!dishId || !targetDayLabel) return { error: 'dish_id and target_day_label are required' }

  const dishSheet = openOrCreateSheet_(DISH_SHEET, DISH_HDR)
  const data = dishSheet.getDataRange().getValues()
  const idIdx     = DISH_HDR.indexOf('dish_id')
  const weekIdx   = DISH_HDR.indexOf('week_id')
  const dayIdx    = DISH_HDR.indexOf('day_label')
  const orderIdx  = DISH_HDR.indexOf('order')
  const kindIdx   = DISH_HDR.indexOf('kind')
  const chosenIdx = DISH_HDR.indexOf('chosen')

  let sourceRow = -1
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === dishId) { sourceRow = i; break }
  }
  if (sourceRow === -1) return { error: 'dish not found' }

  const weekId = cellToStr(data[sourceRow][weekIdx])
  const sourceDayLabel = String(data[sourceRow][dayIdx])
  const kind = String(data[sourceRow][kindIdx])
  if (sourceDayLabel === targetDayLabel) return getWeek(weekId)

  ensureDayMeta_(weekId, targetDayLabel)
  setDayNotCheat_(weekId, targetDayLabel)

  const targetRows = []
  for (let i = 1; i < data.length; i++) {
    if (i === sourceRow) continue
    if (cellToStr(data[i][weekIdx]) === weekId && String(data[i][dayIdx]) === targetDayLabel && String(data[i][kindIdx]) === kind) targetRows.push(i)
  }

  if (targetRows.length === 1) {
    // 1対1のときは入れ替え（スワップ）
    const targetRow = targetRows[0]
    const targetDishId = String(data[targetRow][idIdx])
    const sourceOrder = data[sourceRow][orderIdx]
    const targetOrder = data[targetRow][orderIdx]

    dishSheet.getRange(sourceRow + 1, dayIdx + 1).setValue(targetDayLabel)
    dishSheet.getRange(sourceRow + 1, orderIdx + 1).setValue(targetOrder)
    dishSheet.getRange(sourceRow + 1, chosenIdx + 1).setValue(false)

    dishSheet.getRange(targetRow + 1, dayIdx + 1).setValue(sourceDayLabel)
    dishSheet.getRange(targetRow + 1, orderIdx + 1).setValue(sourceOrder)
    dishSheet.getRange(targetRow + 1, chosenIdx + 1).setValue(false)

    moveDishIngredients_(weekId, sourceDayLabel, targetDayLabel, dishId, targetDishId)
  } else {
    // 0件または2件以上のときは単純追加（移動元からは削除）
    const newOrder = nextDishOrder_(dishSheet, weekId, targetDayLabel, kind)
    dishSheet.getRange(sourceRow + 1, dayIdx + 1).setValue(targetDayLabel)
    dishSheet.getRange(sourceRow + 1, orderIdx + 1).setValue(newOrder)
    dishSheet.getRange(sourceRow + 1, chosenIdx + 1).setValue(false)

    moveDishIngredients_(weekId, sourceDayLabel, targetDayLabel, dishId, null)
  }

  return getWeek(weekId)
}

function moveDishIngredients_(weekId, sourceDayLabel, targetDayLabel, dishId, swapDishId) {
  const ingSheet = openOrCreateSheet_(ING_SHEET, ING_HDR)
  const data = ingSheet.getDataRange().getValues()
  const weekIdx = ING_HDR.indexOf('week_id')
  const dayIdx  = ING_HDR.indexOf('day_label')
  const dishIdx = ING_HDR.indexOf('dish_id')
  for (let i = 1; i < data.length; i++) {
    if (cellToStr(data[i][weekIdx]) !== weekId) continue
    if (String(data[i][dishIdx]) === dishId) {
      ingSheet.getRange(i + 1, dayIdx + 1).setValue(targetDayLabel)
    } else if (swapDishId && String(data[i][dishIdx]) === swapDishId) {
      ingSheet.getRange(i + 1, dayIdx + 1).setValue(sourceDayLabel)
    }
  }
}

function setChosenDish(dishId) {
  if (!dishId) return { error: 'dish_id is required' }
  const dishSheet = openOrCreateSheet_(DISH_SHEET, DISH_HDR)
  const data = dishSheet.getDataRange().getValues()
  const idIdx     = DISH_HDR.indexOf('dish_id')
  const weekIdx   = DISH_HDR.indexOf('week_id')
  const dayIdx    = DISH_HDR.indexOf('day_label')
  const kindIdx   = DISH_HDR.indexOf('kind')
  const chosenIdx = DISH_HDR.indexOf('chosen')

  let weekId = null, dayLabel = null, kind = null, wasChosen = false
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === dishId) {
      weekId = cellToStr(data[i][weekIdx])
      dayLabel = String(data[i][dayIdx])
      kind = String(data[i][kindIdx])
      wasChosen = data[i][chosenIdx] === true || data[i][chosenIdx] === 'true'
      break
    }
  }
  if (!weekId) return { error: 'dish not found' }

  for (let i = 1; i < data.length; i++) {
    if (cellToStr(data[i][weekIdx]) === weekId && String(data[i][dayIdx]) === dayLabel && String(data[i][kindIdx]) === kind) {
      dishSheet.getRange(i + 1, chosenIdx + 1).setValue(!wasChosen && String(data[i][idIdx]) === dishId)
    }
  }
  return getWeek(weekId)
}

// ─────────────────────────────────────────
//  StyleTags
// ─────────────────────────────────────────

function getStyleTags() {
  return sheetToObjs_(openOrCreateSheet_(TAG_SHEET, TAG_HDR))
}

function addTag(label) {
  if (!label) return { error: 'label is required' }
  const sheet = openOrCreateSheet_(TAG_SHEET, TAG_HDR)
  const tagId = Utilities.getUuid()
  appendRow_(sheet, TAG_HDR, { tag_id: tagId, label, created_at: nowStr_() })
  return { saved: true, tag_id: tagId }
}

function removeTag(tagId) {
  if (!tagId) return { error: 'tag_id is required' }
  const sheet = openOrCreateSheet_(TAG_SHEET, TAG_HDR)
  const data  = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === tagId) {
      sheet.deleteRow(i + 1)
      return { deleted: true }
    }
  }
  return { deleted: false }
}

// ─────────────────────────────────────────
//  Preferences（好き嫌い履歴）／お気に入り自動連動
//  好き → お気に入りへ自動追加／苦手 → お気に入りから自動削除
// ─────────────────────────────────────────

function setPreference(dishName, preference, weekId, dayLabel, dishId, kind, recipe, ingredients) {
  if (!dishName || !preference) return { error: 'dish_name and preference are required' }
  const sheet = openOrCreateSheet_(PREF_SHEET, PREF_HDR)
  appendRow_(sheet, PREF_HDR, {
    dish_name: dishName, preference, week_id: weekId || '', day_label: dayLabel || '',
    dish_id: dishId || '', updated_at: nowStr_(),
  })

  if (preference === 'like') {
    addFavorite_(dishName, recipe, ingredients, kind === 'side' ? 'side' : 'main')
  } else if (preference === 'dislike') {
    removeFavoriteByMain_(dishName)
  }

  return { saved: true, favorites: getFavorites() }
}

function getDislikedDishNames_() {
  const rows = sheetToObjs_(openOrCreateSheet_(PREF_SHEET, PREF_HDR))
  return [...new Set(rows.filter(r => r.preference === 'dislike').map(r => r.dish_name).filter(Boolean))]
}

// ─────────────────────────────────────────
//  お気に入り献立（今後の献立生成の候補にする）
//  好き👍で自動追加・苦手👎で自動削除（手動操作は不要）
// ─────────────────────────────────────────

function getFavorites() {
  return sheetToObjs_(openOrCreateSheet_(FAV_SHEET, FAV_HDR))
}

function addFavorite_(main, recipe, ingredients, category) {
  if (!main) return
  const sheet = openOrCreateSheet_(FAV_SHEET, FAV_HDR)
  const existing = sheetToObjs_(sheet).find(r => r.main === main)
  if (existing) return
  appendRow_(sheet, FAV_HDR, {
    fav_id: Utilities.getUuid(), main, side: '', recipe: recipe || '',
    ingredients_json: JSON.stringify(ingredients || []), created_at: nowStr_(),
    category: normalizeCandidateCategory_(category),
  })
}

function removeFavoriteByMain_(main) {
  const sheet = openOrCreateSheet_(FAV_SHEET, FAV_HDR)
  const data  = sheet.getDataRange().getValues()
  const mainIdx = FAV_HDR.indexOf('main')
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][mainIdx]) === main) {
      sheet.deleteRow(i + 1)
      return
    }
  }
}

// ─────────────────────────────────────────
//  候補（スクショから登録・手動保存。お気に入りと同じシートを使う）
// ─────────────────────────────────────────

const CANDIDATE_CATEGORIES = ['main', 'side', 'soup', 'makeahead', 'seasoning', 'drink', 'sweets']
function normalizeCandidateCategory_(category) {
  return CANDIDATE_CATEGORIES.indexOf(category) === -1 ? 'main' : category
}

function addCandidate(main, recipe, ingredients, category, imageBase64, imageMimeType) {
  if (!main) return { error: 'main is required' }
  const sheet = openOrCreateSheet_(FAV_SHEET, FAV_HDR)
  appendRow_(sheet, FAV_HDR, {
    fav_id: Utilities.getUuid(), main, side: '', recipe: recipe || '',
    ingredients_json: JSON.stringify(ingredients || []), created_at: nowStr_(),
    image_url: uploadImageToDrive_(imageBase64, imageMimeType), category: normalizeCandidateCategory_(category),
  })
  return { favorites: getFavorites() }
}

function updateCandidate(favId, main, recipe, ingredients, category, imageBase64, imageMimeType, removeImage) {
  if (!favId) return { error: 'fav_id is required' }
  if (!main) return { error: 'main is required' }
  const sheet = openOrCreateSheet_(FAV_SHEET, FAV_HDR)
  const data  = sheet.getDataRange().getValues()
  const idIdx     = FAV_HDR.indexOf('fav_id')
  const mainIdx   = FAV_HDR.indexOf('main')
  const recipeIdx = FAV_HDR.indexOf('recipe')
  const ingIdx    = FAV_HDR.indexOf('ingredients_json')
  const catIdx    = FAV_HDR.indexOf('category')
  const imgIdx    = FAV_HDR.indexOf('image_url')
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === favId) {
      sheet.getRange(i + 1, mainIdx + 1).setValue(main)
      sheet.getRange(i + 1, recipeIdx + 1).setValue(recipe || '')
      sheet.getRange(i + 1, ingIdx + 1).setValue(JSON.stringify(ingredients || []))
      sheet.getRange(i + 1, catIdx + 1).setValue(normalizeCandidateCategory_(category))
      if (imageBase64) {
        sheet.getRange(i + 1, imgIdx + 1).setValue(uploadImageToDrive_(imageBase64, imageMimeType))
      } else if (removeImage) {
        sheet.getRange(i + 1, imgIdx + 1).setValue('')
      }
      break
    }
  }
  return { favorites: getFavorites() }
}

function removeCandidate(favId) {
  if (!favId) return { error: 'fav_id is required' }
  const sheet = openOrCreateSheet_(FAV_SHEET, FAV_HDR)
  const data  = sheet.getDataRange().getValues()
  const idIdx = FAV_HDR.indexOf('fav_id')
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === favId) {
      sheet.deleteRow(i + 1)
      break
    }
  }
  return { favorites: getFavorites() }
}

function stripEmojiAndSpecialChars_(str) {
  if (!str) return str
  return str
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function driveThumbnailUrl_(fileId) {
  // drive.google.com/uc?id=... はブラウザでの<img>埋め込み時にCORP(Cross-Origin-Resource-Policy)で
  // ブロックされ画像が表示されないため、埋め込み用に設計されたthumbnailエンドポイントを使う。
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000'
}

function uploadImageToDrive_(base64, mimeType) {
  if (!base64) return ''
  try {
    const bytes = Utilities.base64Decode(base64)
    const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', 'thumbnail-' + Utilities.getUuid() + '.jpg')
    const file = DriveApp.createFile(blob)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    return driveThumbnailUrl_(file.getId())
  } catch (ex) {
    return ''
  }
}

function extractTextFromClaudeResponse_(result) {
  const block = result && result.content && result.content[0]
  const text = block && block.text
  if (!text) {
    throw new Error('AIからの応答を解析できませんでした。画像やテキストに含まれる絵文字・特殊文字が原因の場合があります。内容を確認のうえ、もう一度お試しください。')
  }
  return text
}

function extractDishFromImage(images) {
  if (!images || images.length === 0) return { error: 'images is required' }
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY')
  if (!apiKey) {
    throw new Error('GASのスクリプトプロパティに CLAUDE_API_KEY を設定してください（プロジェクトの設定 → スクリプトプロパティ）')
  }

  const prompt = [
    images.length > 1
      ? 'これらの画像は同じ料理レシピ・献立を撮影した複数枚のスクリーンショットです（1枚に収まらないため分割撮影）。全体を1つのレシピとしてまとめて読み取ってください。'
      : 'この画像は料理のレシピ・献立のスクリーンショットです。',
    '写っている料理（主菜・副菜のどちらか1品）について、以下のJSON形式のみを出力してください（説明文は一切不要）。',
    '複数の料理が写っている場合は、中心となる1品のみを対象にしてください。',
    '読み取れない項目は空文字または空配列にしてください。料理が全く写っていない場合はmainを空文字にしてください。',
    '',
    '{',
    '  "main": "料理名",',
    '  "recipe": "1. 〜する\\n2. 〜する",',
    '  "ingredients": [{"name": "食材名", "amount": "分量", "note": "備考（下味用・たれ用など使い道の分類。無ければ空文字）"}]',
    '}',
  ].join('\n')

  const content = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mime_type, data: img.base64 },
  }))
  content.push({ type: 'text', text: prompt })

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    payload: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content }],
    }),
    muteHttpExceptions: true,
  })

  const code = response.getResponseCode()
  const body = response.getContentText()
  const result = JSON.parse(body)
  if (code !== 200) {
    throw new Error('Claude API エラー(' + code + '): ' + (result.error && result.error.message ? result.error.message : body))
  }

  const text = extractTextFromClaudeResponse_(result)
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const extracted = JSON.parse(jsonText)

  return {
    main: stripEmojiAndSpecialChars_(extracted.main || ''),
    recipe: stripEmojiAndSpecialChars_(extracted.recipe || ''),
    ingredients: (extracted.ingredients || []).map((ing) => ({
      name: stripEmojiAndSpecialChars_(ing.name || ''),
      amount: stripEmojiAndSpecialChars_(ing.amount || ''),
      note: stripEmojiAndSpecialChars_(ing.note || ''),
    })),
    imageUrl: '',
  }
}

function extractDishFromText(text) {
  if (!text) return { error: 'text is required' }
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY')
  if (!apiKey) {
    throw new Error('GASのスクリプトプロパティに CLAUDE_API_KEY を設定してください（プロジェクトの設定 → スクリプトプロパティ）')
  }

  const cleanText = stripEmojiAndSpecialChars_(text)
  if (!cleanText) return { error: 'text is required' }

  const prompt = [
    '以下はSNS（Instagramなど）の料理レシピ投稿のキャプション文です。',
    'ハッシュタグや宣伝文句は無視し、実際のレシピ情報（主菜・副菜のどちらか1品）のみを抽出して、',
    '以下のJSON形式のみを出力してください（説明文は一切不要）。',
    '読み取れない項目は空文字または空配列にしてください。レシピ情報が全く含まれない場合はmainを空文字にしてください。',
    '',
    '{',
    '  "main": "料理名",',
    '  "recipe": "1. 〜する\\n2. 〜する",',
    '  "ingredients": [{"name": "食材名", "amount": "分量", "note": "備考（下味用・たれ用など使い道の分類。無ければ空文字）"}]',
    '}',
    '',
    '--- キャプション文 ---',
    cleanText,
  ].join('\n')

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    payload: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
    muteHttpExceptions: true,
  })

  const code = response.getResponseCode()
  const body = response.getContentText()
  const result = JSON.parse(body)
  if (code !== 200) {
    throw new Error('Claude API エラー(' + code + '): ' + (result.error && result.error.message ? result.error.message : body))
  }

  const responseText = extractTextFromClaudeResponse_(result)
  const jsonText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const extracted = JSON.parse(jsonText)

  return {
    main: stripEmojiAndSpecialChars_(extracted.main || ''),
    recipe: stripEmojiAndSpecialChars_(extracted.recipe || ''),
    ingredients: (extracted.ingredients || []).map((ing) => ({
      name: stripEmojiAndSpecialChars_(ing.name || ''),
      amount: stripEmojiAndSpecialChars_(ing.amount || ''),
      note: stripEmojiAndSpecialChars_(ing.note || ''),
    })),
    imageUrl: '',
  }
}

// ─────────────────────────────────────────
//  CheatDaySetting
// ─────────────────────────────────────────

function getCheatDay() {
  const sheet = openOrCreateSheet_(CHEAT_SHEET, CHEAT_HDR)
  const data  = sheet.getDataRange().getValues()
  return data.length > 1 ? cellToStr(data[1][0]) : ''
}

function setCheatDay(cheatDay) {
  const sheet = openOrCreateSheet_(CHEAT_SHEET, CHEAT_HDR)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1).setValue(cheatDay || '')
  } else {
    sheet.appendRow([cheatDay || ''])
  }
  return { saved: true, cheat_day: cheatDay || '' }
}

// ─────────────────────────────────────────
//  StockIngredients（手持ちの食材）
// ─────────────────────────────────────────

function getStockIngredients() {
  return sheetToObjs_(openOrCreateSheet_(STOCK_SHEET, STOCK_HDR))
    .map(r => ({ ...r, category: categorizeIngredient_(r.name) }))
}

function mergeQuantity_(existingQty, addedQty) {
  return sumAmounts_([existingQty, addedQty])
}

function addStockIngredient(name, quantity) {
  if (!name) return { error: 'name is required' }
  const sheet = openOrCreateSheet_(STOCK_SHEET, STOCK_HDR)
  const existing = sheetToObjs_(sheet).find(r => r.name === name)
  if (existing) return updateStockIngredientQuantity(existing.id, mergeQuantity_(existing.quantity, quantity))
  const id = Utilities.getUuid()
  appendRow_(sheet, STOCK_HDR, { id, name, quantity: quantity || '', updated_at: nowStr_() })
  return { saved: true, id, ingredients: getStockIngredients() }
}

function updateStockIngredientQuantity(id, quantity) {
  if (!id) return { error: 'id is required' }
  const sheet = openOrCreateSheet_(STOCK_SHEET, STOCK_HDR)
  const data  = sheet.getDataRange().getValues()
  const idIdx = STOCK_HDR.indexOf('id')
  const qtyIdx = STOCK_HDR.indexOf('quantity')
  const updatedIdx = STOCK_HDR.indexOf('updated_at')
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === id) {
      sheet.getRange(i + 1, qtyIdx + 1).setValue(quantity || '')
      sheet.getRange(i + 1, updatedIdx + 1).setValue(nowStr_())
      return { saved: true, ingredients: getStockIngredients() }
    }
  }
  return { saved: false, error: 'not found' }
}

function removeStockIngredient(id) {
  if (!id) return { error: 'id is required' }
  const sheet = openOrCreateSheet_(STOCK_SHEET, STOCK_HDR)
  const data  = sheet.getDataRange().getValues()
  const idIdx = STOCK_HDR.indexOf('id')
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === id) {
      sheet.deleteRow(i + 1)
      return { deleted: true, ingredients: getStockIngredients() }
    }
  }
  return { deleted: false, ingredients: getStockIngredients() }
}

// ─────────────────────────────────────────
//  数量の合計計算（「150g + 150g」ではなく「300g」で表示）
// ─────────────────────────────────────────

function parseAmount_(str) {
  const m = String(str).trim().match(/^(\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return null
  let value
  if (m[1].indexOf('/') >= 0) {
    const parts = m[1].split('/')
    value = Number(parts[1]) ? Number(parts[0]) / Number(parts[1]) : 0
  } else {
    value = parseFloat(m[1])
  }
  return { value, unit: m[2].trim() }
}

function formatAmount_(value, unit) {
  const rounded = Math.round(value * 1000) / 1000
  const whole = Math.floor(rounded)
  const frac = rounded - whole
  const knownFracs = [
    [1 / 8, '1/8'], [1 / 6, '1/6'], [1 / 5, '1/5'], [1 / 4, '1/4'], [1 / 3, '1/3'],
    [3 / 8, '3/8'], [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'],
    [4 / 5, '4/5'], [5 / 6, '5/6'], [7 / 8, '7/8'],
  ]
  for (let i = 0; i < knownFracs.length; i++) {
    if (Math.abs(frac - knownFracs[i][0]) < 0.02) {
      const wholePart = whole > 0 ? String(whole) : ''
      return `${wholePart}${knownFracs[i][1]}${unit}`
    }
  }
  return `${rounded}${unit}`
}

function sumAmounts_(amounts) {
  const list = amounts.filter(a => a)
  if (list.length === 0) return ''
  const groups = {}
  const order = []
  list.forEach(a => {
    const parsed = parseAmount_(a)
    const key = parsed ? ('u:' + parsed.unit) : ('raw:' + a)
    if (!(key in groups)) {
      groups[key] = parsed ? { value: 0, unit: parsed.unit } : { raw: a }
      order.push(key)
    }
    if (parsed) groups[key].value += parsed.value
  })
  return order.map(k => {
    const g = groups[k]
    return g.raw !== undefined ? g.raw : formatAmount_(g.value, g.unit)
  }).join(' + ')
}

// ─────────────────────────────────────────
//  買い物リスト（2日分ずつ集計・作った方＝chosenの献立を採用。未選択時は先頭の候補を仮採用）
// ─────────────────────────────────────────

function getShoppingList(weekId) {
  if (!weekId) return { groups: [] }
  const dishRows    = sheetToObjs_(openOrCreateSheet_(DISH_SHEET, DISH_HDR)).filter(r => r.week_id === weekId)
  const ingredients = sheetToObjs_(openOrCreateSheet_(ING_SHEET, ING_HDR)).filter(r => r.week_id === weekId)

  const dishesByDay = {}
  dishRows.forEach(d => { (dishesByDay[d.day_label] = dishesByDay[d.day_label] || []).push(d) })
  Object.keys(dishesByDay).forEach(day => {
    dishesByDay[day].sort((a, b) => Number(a.order) - Number(b.order))
  })

  const chosenDishIdsByDay = {}
  Object.entries(dishesByDay).forEach(([day, list]) => {
    const ids = []
    ;['main', 'side'].forEach(kind => {
      const ofKind = list.filter(d => d.kind === kind)
      if (ofKind.length === 0) return
      const chosen = ofKind.find(d => d.chosen === 'true' || d.chosen === true)
      ids.push(chosen ? chosen.dish_id : ofKind[0].dish_id)
    })
    chosenDishIdsByDay[day] = ids
  })

  const groups = SHOPPING_GROUPS.map(days => {
    const itemMap = {}
    days.forEach(day => {
      const dishIds = chosenDishIdsByDay[day] || []
      dishIds.forEach(dishId => {
        ingredients
          .filter(ing => ing.day_label === day && ing.dish_id === dishId)
          .forEach(ing => {
            if (!itemMap[ing.ingredient_name]) itemMap[ing.ingredient_name] = []
            if (ing.amount) itemMap[ing.ingredient_name].push(ing.amount)
          })
      })
    })
    const itemsByCategory = {}
    Object.entries(itemMap).forEach(([ingredient_name, amounts]) => {
      const cat = categorizeIngredient_(ingredient_name)
      if (!itemsByCategory[cat]) itemsByCategory[cat] = []
      itemsByCategory[cat].push({ ingredient_name, amount: sumAmounts_(amounts) })
    })
    const categories = INGREDIENT_CATEGORY_ORDER
      .filter(cat => itemsByCategory[cat] && itemsByCategory[cat].length > 0)
      .map(cat => ({ category: cat, items: itemsByCategory[cat] }))
    return {
      label: days.join('・'),
      days,
      categories,
    }
  })

  return { groups, checked: getCheckedShoppingItems_(weekId) }
}

// ─────────────────────────────────────────
//  買い物リストのチェック状態（サーバー保存・全端末共通）
// ─────────────────────────────────────────

function getCheckedShoppingItems_(weekId) {
  return sheetToObjs_(openOrCreateSheet_(CHECKED_SHEET, CHECKED_HDR))
    .filter(r => r.week_id === weekId)
    .map(r => `${r.group_label}__${r.ingredient_name}`)
}

function checkShoppingItem(weekId, groupLabel, ingredientName) {
  if (!weekId || !groupLabel || !ingredientName) return { error: 'week_id, group_label and ingredient_name are required' }
  const sheet = openOrCreateSheet_(CHECKED_SHEET, CHECKED_HDR)
  const already = sheetToObjs_(sheet).some(r => r.week_id === weekId && r.group_label === groupLabel && r.ingredient_name === ingredientName)
  if (!already) {
    appendRow_(sheet, CHECKED_HDR, { week_id: weekId, group_label: groupLabel, ingredient_name: ingredientName, checked_at: nowStr_() })
  }
  return { saved: true, checked: getCheckedShoppingItems_(weekId) }
}

function uncheckShoppingItem(weekId, groupLabel, ingredientName) {
  if (!weekId || !groupLabel || !ingredientName) return { error: 'week_id, group_label and ingredient_name are required' }
  const sheet = openOrCreateSheet_(CHECKED_SHEET, CHECKED_HDR)
  const data = sheet.getDataRange().getValues()
  const weekIdx = CHECKED_HDR.indexOf('week_id')
  const groupIdx = CHECKED_HDR.indexOf('group_label')
  const nameIdx = CHECKED_HDR.indexOf('ingredient_name')
  for (let i = data.length - 1; i >= 1; i--) {
    if (cellToStr(data[i][weekIdx]) === weekId && cellToStr(data[i][groupIdx]) === groupLabel && cellToStr(data[i][nameIdx]) === ingredientName) {
      sheet.deleteRow(i + 1)
    }
  }
  return { saved: true, checked: getCheckedShoppingItems_(weekId) }
}

// ─────────────────────────────────────────
//  献立生成（登録済み候補から選ぶ。AIによる新規考案はしない）
//  事前設定: GASエディタ → プロジェクトの設定 → スクリプトプロパティ
//            キー: CLAUDE_API_KEY  値: sk-ant-...（候補のスクショ解析に使用）
//
//  手持ちの食材（StockIngredients）を考慮:
//    候補の ingredients_json に、手持ちの食材名と一致・部分一致する材料が
//    多く含まれる候補ほど優先的に選ばれるよう並び替える（買い足しを減らす）。
//  曜日を考慮:
//    週の途中で再生成しても、今日より前（過ぎた）曜日の献立は上書きしない。
// ─────────────────────────────────────────

function normalizeIngredientName_(name) {
  return String(name || '').trim().toLowerCase()
}

function candidateIngredientNames_(candidate) {
  let ings
  try { ings = JSON.parse(candidate.ingredients_json || '[]') } catch (ex) { ings = [] }
  return (ings || []).map(ing => normalizeIngredientName_(ing && ing.name)).filter(Boolean)
}

// 候補の材料名が、手持ちの食材名のいずれかと一致・部分一致する数を数える
function stockMatchCount_(candidate, stockNames) {
  const ingNames = candidateIngredientNames_(candidate)
  let count = 0
  ingNames.forEach(n => {
    if (stockNames.some(s => n.indexOf(s) !== -1 || s.indexOf(n) !== -1)) count++
  })
  return count
}

// 手持ちの食材を多く使う候補ほど先頭に来るよう並び替える（一致数が同じ場合は
// 元の順序＝shuffle_ 後のランダム順を維持し、毎回違う献立になるようにする）
function prioritizeByStock_(pool) {
  const stockNames = getStockIngredients().map(s => normalizeIngredientName_(s.name)).filter(Boolean)
  if (stockNames.length === 0) return pool
  return pool
    .map((c, idx) => ({ c, idx, score: stockMatchCount_(c, stockNames) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map(x => x.c)
}

function generateWeek(weekId) {
  if (!weekId) throw new Error('week_id is required')

  const cheatDay  = getCheatDay()
  const dislikes  = getDislikedDishNames_()
  const candidates = getFavorites().filter(f => dislikes.indexOf(f.main) === -1)

  const dishSheet = openOrCreateSheet_(DISH_SHEET, DISH_HDR)
  const ingSheet  = openOrCreateSheet_(ING_SHEET, ING_HDR)
  const metaSheet = openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)

  // 「これをつくる」で確定済みの献立は、日×主菜/副菜ごとに再作成しても変わらないように保持する
  // （過ぎた曜日の献立を丸ごと保持する際にも使う）
  const existingMeta        = sheetToObjs_(metaSheet).filter(r => r.week_id === weekId)
  const existingDishes      = sheetToObjs_(dishSheet).filter(d => d.week_id === weekId)
  const existingIngredients = sheetToObjs_(ingSheet).filter(ing => ing.week_id === weekId)
  const keptByDayKind = {}
  existingDishes.forEach(d => {
    const key = d.day_label + '__' + d.kind
    if (d.chosen === 'true' && !keptByDayKind[key]) {
      keptByDayKind[key] = {
        dish: d,
        ingredients: existingIngredients.filter(ing => ing.dish_id === d.dish_id),
      }
    }
  })
  const keptNames = { main: [], side: [] }
  Object.values(keptByDayKind).forEach(k => {
    if (keptNames[k.dish.kind]) keptNames[k.dish.kind].push(k.dish.name)
  })

  const mainPool = prioritizeByStock_(shuffle_(candidates.filter(f => normalizeCandidateCategory_(f.category) === 'main' && keptNames.main.indexOf(f.main) === -1)))
  const sidePool = prioritizeByStock_(shuffle_(candidates.filter(f => normalizeCandidateCategory_(f.category) === 'side' && keptNames.side.indexOf(f.main) === -1)))

  const days = buildWeekDates_(weekId)
  const cheatIdx = DAY_LABELS.indexOf(cheatDay)

  // 今日より前（過ぎた）曜日かどうか。過ぎた曜日は再生成対象から外し、既存の献立をそのまま保持する
  const todayStr = cellToStr(new Date())
  const isPastDay = i => Boolean(days[i]) && days[i] < todayStr
  const existingMetaByDay = {}
  existingMeta.forEach(m => { existingMetaByDay[m.day_label] = m })

  clearWeekRows_(metaSheet, WEEK_HDR, weekId)
  clearWeekRows_(dishSheet, DISH_HDR, weekId)
  clearWeekRows_(ingSheet, ING_HDR, weekId)
  clearWeekRows_(openOrCreateSheet_(CHECKED_SHEET, CHECKED_HDR), CHECKED_HDR, weekId)

  const metaRows = []
  const dishRows = []
  const ingRows  = []

  DAY_LABELS.forEach((dayLabel, i) => {
    const isCheat = i === cheatIdx
    const past = isPastDay(i)
    const prevMeta = existingMetaByDay[dayLabel]
    metaRows.push(WEEK_HDR.map(col => {
      switch (col) {
        case 'week_id':   return weekId
        case 'day_label': return dayLabel
        case 'date':      return days[i]
        case 'cheat':     return past && prevMeta ? prevMeta.cheat === 'true' : isCheat
        case 'tags':      return past && prevMeta ? prevMeta.tags : ''
        default:          return ''
      }
    }))
  })

  let mainCursor = 0
  let sideCursor = 0
  const nextMain = () => mainCursor < mainPool.length ? mainPool[mainCursor++] : null
  const nextSide = () => sideCursor < sidePool.length ? sidePool[sideCursor++] : null
  const candidateIngredients = c => {
    try { return JSON.parse(c.ingredients_json || '[]') } catch (ex) { return [] }
  }

  const SLOTS_PER_KIND = 2

  const fillKind = (dayLabel, kind, nextCandidate) => {
    const key = dayLabel + '__' + kind
    const kept = keptByDayKind[key]
    const keptOrder = kept ? Number(kept.dish.order) : null

    if (kept) {
      dishRows.push(DISH_HDR.map(col => {
        switch (col) {
          case 'week_id':   return weekId
          case 'day_label': return dayLabel
          case 'dish_id':   return kept.dish.dish_id
          case 'order':     return kept.dish.order
          case 'kind':      return kind
          case 'name':      return kept.dish.name
          case 'recipe':    return kept.dish.recipe
          case 'chosen':    return 'true'
          case 'image_url': return kept.dish.image_url || ''
          default:          return ''
        }
      }))
      kept.ingredients.forEach(ing => {
        ingRows.push([weekId, dayLabel, kept.dish.dish_id, ing.ingredient_name, ing.amount || '', ing.note || ''])
      })
    }

    for (let slot = 0; slot < SLOTS_PER_KIND; slot++) {
      if (kept && keptOrder === slot) continue
      const c = nextCandidate()
      if (!c) continue

      const dishId = Utilities.getUuid()
      dishRows.push(DISH_HDR.map(col => {
        switch (col) {
          case 'week_id':   return weekId
          case 'day_label': return dayLabel
          case 'dish_id':   return dishId
          case 'order':     return slot
          case 'kind':      return kind
          case 'name':      return c.main
          case 'recipe':    return c.recipe || ''
          case 'chosen':    return ''
          case 'image_url': return c.image_url || ''
          default:          return ''
        }
      }))

      candidateIngredients(c).forEach(ing => {
        if (ing && ing.name) ingRows.push([weekId, dayLabel, dishId, ing.name, ing.amount || '', ing.note || ''])
      })
    }
  }

  DAY_LABELS.forEach((dayLabel, i) => {
    if (i === cheatIdx) return
    if (isPastDay(i)) {
      // 過ぎた曜日は再生成せず、既存の献立・材料をそのまま引き継ぐ
      existingDishes.filter(d => d.day_label === dayLabel).forEach(d => {
        dishRows.push(DISH_HDR.map(col => d[col] !== undefined ? d[col] : ''))
      })
      existingIngredients.filter(ing => ing.day_label === dayLabel).forEach(ing => {
        ingRows.push(ING_HDR.map(col => ing[col] !== undefined ? ing[col] : ''))
      })
      return
    }
    fillKind(dayLabel, 'main', nextMain)
    fillKind(dayLabel, 'side', nextSide)
  })

  metaSheet.getRange(metaSheet.getLastRow() + 1, 1, metaRows.length, WEEK_HDR.length).setValues(metaRows)
  if (dishRows.length > 0) {
    dishSheet.getRange(dishSheet.getLastRow() + 1, 1, dishRows.length, DISH_HDR.length).setValues(dishRows)
  }
  if (ingRows.length > 0) {
    ingSheet.getRange(ingSheet.getLastRow() + 1, 1, ingRows.length, ING_HDR.length).setValues(ingRows)
  }

  return getWeek(weekId)
}

// week_id（月曜日, 'YYYY-MM-DD'）から7日分の日付文字列を作る
function buildWeekDates_(weekId) {
  const m = String(weekId).match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return DAY_LABELS.map(() => '')
  const base = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return DAY_LABELS.map((_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return cellToStr(d)
  })
}
