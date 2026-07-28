// =============================================================
//  週の晩ごはん — Google Apps Script API
// =============================================================

const SPREADSHEET_ID = '1msjKZ1gpog3igLrI5LLHsTKzp4bNAjRNPmGX5XdnZHQ'

const WEEK_SHEET  = 'WeekPlan'
const WEEK_HDR    = ['week_id', 'day_label', 'date', 'cheat', 'main_A', 'side_A', 'main_B', 'side_B', 'tags', 'chosen_variant']
const ING_SHEET    = 'Ingredients'
const ING_HDR      = ['week_id', 'day_label', 'variant', 'ingredient_name', 'amount']
const TAG_SHEET    = 'StyleTags'
const TAG_HDR      = ['tag_id', 'label', 'created_at']
const PREF_SHEET  = 'Preferences'
const PREF_HDR    = ['dish_name', 'preference', 'week_id', 'day_label', 'variant', 'updated_at']
const CHEAT_SHEET = 'CheatDaySetting'
const CHEAT_HDR   = ['cheat_day']

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const SHOPPING_GROUPS = [['月', '火'], ['水', '木'], ['金', '土'], ['日']]

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
    switch (action) {
      case 'getWeek':          return ok(getWeek(e.parameter.week_id || ''))
      case 'getShoppingList':  return ok(getShoppingList(e.parameter.week_id || ''))
      default:                 return err('Unknown action: ' + action)
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
    switch (body.action) {
      case 'generateWeek':     return ok(generateWeek(body.week_id))
      case 'setPreference':    return ok(setPreference(body.dish_name, body.preference, body.week_id, body.day_label, body.variant))
      case 'addTag':           return ok(addTag(body.label))
      case 'removeTag':        return ok(removeTag(body.tag_id))
      case 'setCheatDay':      return ok(setCheatDay(body.cheat_day))
      case 'setChosenVariant': return ok(setChosenVariant(body.week_id, body.day_label, body.variant))
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

function openOrCreateSheet_(name, hdr) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.appendRow(hdr)
    sheet.setFrozenRows(1)
    const r = sheet.getRange(1, 1, 1, hdr.length)
    r.setBackground('#E8F0FE')
    r.setFontColor('#003087')
    r.setFontWeight('bold')
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

// ─────────────────────────────────────────
//  週の献立（WeekPlan / Ingredients）
// ─────────────────────────────────────────

function getWeek(weekId) {
  const weekSheet = openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)
  const ingSheet  = openOrCreateSheet_(ING_SHEET, ING_HDR)
  const weekPlan   = sheetToObjs_(weekSheet).filter(r => r.week_id === weekId)
  const ingredients = sheetToObjs_(ingSheet).filter(r => r.week_id === weekId)
  return {
    weekPlan,
    ingredients,
    styleTags:   getStyleTags(),
    preferences: sheetToObjs_(openOrCreateSheet_(PREF_SHEET, PREF_HDR)),
    cheatDay:    getCheatDay(),
  }
}

function clearWeekRows_(sheet, hdr, weekId) {
  const data = sheet.getDataRange().getValues()
  const weekIdx = hdr.indexOf('week_id')
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][weekIdx]) === weekId) sheet.deleteRow(i + 1)
  }
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
//  Preferences（好き嫌い履歴）
// ─────────────────────────────────────────

function setPreference(dishName, preference, weekId, dayLabel, variant) {
  if (!dishName || !preference) return { error: 'dish_name and preference are required' }
  const sheet = openOrCreateSheet_(PREF_SHEET, PREF_HDR)
  appendRow_(sheet, PREF_HDR, {
    dish_name: dishName, preference, week_id: weekId || '', day_label: dayLabel || '',
    variant: variant || '', updated_at: nowStr_(),
  })
  return { saved: true }
}

function getDislikedDishNames_() {
  const rows = sheetToObjs_(openOrCreateSheet_(PREF_SHEET, PREF_HDR))
  return [...new Set(rows.filter(r => r.preference === 'dislike').map(r => r.dish_name).filter(Boolean))]
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
//  作った方（A/B）の選択
// ─────────────────────────────────────────

function setChosenVariant(weekId, dayLabel, variant) {
  if (!weekId || !dayLabel) return { error: 'week_id and day_label are required' }
  const sheet = openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)
  const data  = sheet.getDataRange().getValues()
  const weekIdx = WEEK_HDR.indexOf('week_id')
  const dayIdx  = WEEK_HDR.indexOf('day_label')
  const chosenIdx = WEEK_HDR.indexOf('chosen_variant')
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][weekIdx]) === weekId && String(data[i][dayIdx]) === dayLabel) {
      sheet.getRange(i + 1, chosenIdx + 1).setValue(variant || '')
      return { saved: true }
    }
  }
  return { saved: false, error: 'day not found' }
}

// ─────────────────────────────────────────
//  買い物リスト（2日分ずつ集計）
// ─────────────────────────────────────────

function getShoppingList(weekId) {
  if (!weekId) return { groups: [] }
  const weekPlan   = sheetToObjs_(openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)).filter(r => r.week_id === weekId)
  const ingredients = sheetToObjs_(openOrCreateSheet_(ING_SHEET, ING_HDR)).filter(r => r.week_id === weekId)

  const variantByDay = {}
  weekPlan.forEach(r => { variantByDay[r.day_label] = r.chosen_variant || 'A' })

  const groups = SHOPPING_GROUPS.map(days => {
    const itemMap = {}
    days.forEach(day => {
      const variant = variantByDay[day]
      if (!variant) return
      ingredients
        .filter(ing => ing.day_label === day && ing.variant === variant)
        .forEach(ing => {
          if (!itemMap[ing.ingredient_name]) itemMap[ing.ingredient_name] = []
          if (ing.amount) itemMap[ing.ingredient_name].push(ing.amount)
        })
    })
    return {
      label: days.join('・'),
      days,
      items: Object.entries(itemMap).map(([ingredient_name, amounts]) => ({ ingredient_name, amounts })),
    }
  })

  return { groups }
}

// ─────────────────────────────────────────
//  献立生成（Claude API）
//  事前設定: GASエディタ → プロジェクトの設定 → スクリプトプロパティ
//            キー: CLAUDE_API_KEY  値: sk-ant-...
// ─────────────────────────────────────────

function generateWeek(weekId) {
  if (!weekId) throw new Error('week_id is required')

  const styleTags = getStyleTags().map(t => t.label)
  const cheatDay  = getCheatDay()
  const dislikes  = getDislikedDishNames_()

  const days = buildWeekDates_(weekId)
  const cheatIdx = DAY_LABELS.indexOf(cheatDay)

  const menu = callClaudeForWeek_(styleTags, dislikes, cheatDay)

  const weekSheet = openOrCreateSheet_(WEEK_SHEET, WEEK_HDR)
  const ingSheet  = openOrCreateSheet_(ING_SHEET, ING_HDR)
  clearWeekRows_(weekSheet, WEEK_HDR, weekId)
  clearWeekRows_(ingSheet, ING_HDR, weekId)

  const weekRows = []
  const ingRows  = []

  DAY_LABELS.forEach((dayLabel, i) => {
    const d = menu[i] || {}
    const isCheat = i === cheatIdx
    weekRows.push(WEEK_HDR.map(col => {
      switch (col) {
        case 'week_id':         return weekId
        case 'day_label':       return dayLabel
        case 'date':            return days[i]
        case 'cheat':           return isCheat
        case 'main_A':          return isCheat ? '' : (d.main_A || '')
        case 'side_A':          return isCheat ? '' : (d.side_A || '')
        case 'main_B':          return isCheat ? '' : (d.main_B || '')
        case 'side_B':          return isCheat ? '' : (d.side_B || '')
        case 'tags':            return isCheat ? '' : (d.tags || []).join(',')
        case 'chosen_variant':  return ''
        default:                return ''
      }
    }))

    if (!isCheat) {
      ;['A', 'B'].forEach(variant => {
        const list = variant === 'A' ? (d.ingredients_A || []) : (d.ingredients_B || [])
        list.forEach(ing => {
          ingRows.push([weekId, dayLabel, variant, ing.name || '', ing.amount || ''])
        })
      })
    }
  })

  weekSheet.getRange(weekSheet.getLastRow() + 1, 1, weekRows.length, WEEK_HDR.length).setValues(weekRows)
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

function callClaudeForWeek_(styleTags, dislikes, cheatDay) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY')
  if (!apiKey) {
    throw new Error('GASのスクリプトプロパティに CLAUDE_API_KEY を設定してください（プロジェクトの設定 → スクリプトプロパティ）')
  }

  const prompt = buildWeekPrompt_(styleTags, dislikes, cheatDay)

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    payload: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
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

  const text = result.content[0].text
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  return JSON.parse(jsonText)
}

function buildWeekPrompt_(styleTags, dislikes, cheatDay) {
  const tagsLine = styleTags.length > 0 ? styleTags.join('、') : '指定なし'
  const dislikeLine = dislikes.length > 0 ? dislikes.join('、') : '特になし'
  const cheatLine = cheatDay ? `${cheatDay}曜日はチートデイ（外食・惣菜などで自炊しない日）` : 'チートデイの指定なし'

  return [
    'あなたは家庭料理の献立プランナーです。1週間（月〜日）の晩ごはん献立を考えてください。',
    '',
    '## 条件',
    `- 適用したいスタイルタグ: ${tagsLine}`,
    `- 過去に不評だった料理（できるだけ避ける）: ${dislikeLine}`,
    `- ${cheatLine}`,
    '- 各日について、メイン料理＋副菜の組み合わせを「A案」「B案」の2パターン用意する。B案はA案とできるだけ同じ食材を使い、調理法や味付けを変えたバリエーションにする。',
    '- 週全体で食材の重複が最大化するように（買い物の無駄が出ないように）7日分を設計する。',
    '- チートデイに該当する曜日は、main_A/side_A/main_B/side_B/tags/ingredients_A/ingredients_Bをすべて空文字または空配列にする。',
    '',
    '## 出力形式',
    '説明文は一切付けず、以下のJSON配列のみを出力してください（月・火・水・木・金・土・日の順で7要素、他のキーは含めない）。',
    '',
    '[',
    '  {',
    '    "main_A": "鮭の塩麹焼き", "side_A": "ほうれん草としめじの煮浸し",',
    '    "main_B": "鮭としめじのホイル蒸し", "side_B": "豆腐とほうれん草の白和え",',
    '    "tags": ["油控えめ"],',
    '    "ingredients_A": [{"name": "鮭", "amount": "4切れ"}, {"name": "ほうれん草", "amount": "1束"}],',
    '    "ingredients_B": [{"name": "鮭", "amount": "4切れ"}, {"name": "ほうれん草", "amount": "1束"}]',
    '  }',
    ']',
  ].join('\n')
}
