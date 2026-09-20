import { useEffect, useState, useCallback, useRef } from 'react'
import { gasApi, isGasReady } from './utils/gasApi'
import { readCache, writeCache } from './utils/localCache'
import { currentWeekId, shiftWeekId } from './utils/weekUtils'
import WeekPlanView from './components/WeekPlanView'
import ShoppingListView from './components/ShoppingListView'
import SettingsView from './components/SettingsView'
import CandidatesView from './components/CandidatesView'
import LoadingOverlay from './components/LoadingOverlay'

const REVEAL_DURATION_MS = 2500

const EMPTY_WEEK = { weekPlan: [], ingredients: [], styleTags: [], preferences: [], favorites: [], cheatDay: '' }

const weekCacheKey     = (id) => `week:${id}`
const shoppingCacheKey = (id) => `shopping:${id}`
const STOCK_CACHE_KEY  = 'stock'

// GASのレスポンスからアプリが使うフィールドだけを取り出す（ok等のメタをキャッシュに残さない）
function pickWeek(res) {
  return {
    weekPlan:    res.weekPlan    || [],
    ingredients: res.ingredients || [],
    styleTags:   res.styleTags   || [],
    preferences: res.preferences || [],
    favorites:   res.favorites   || [],
    cheatDay:    res.cheatDay    || '',
  }
}

const TABS = [
  { id: 'plan', label: '献立' },
  { id: 'shopping', label: '買い物・食材' },
  { id: 'candidates', label: '候補' },
  { id: 'settings', label: '設定' },
]

export default function App() {
  const [weekId, setWeekId] = useState(currentWeekId)
  const [tab, setTab] = useState('plan')
  // 初回描画は前回のキャッシュから。ネットワークを待たずに画面が出る。
  const [weekData, setWeekData] = useState(() => readCache(weekCacheKey(currentWeekId())) || EMPTY_WEEK)
  const [shoppingGroups, setShoppingGroups] = useState([])
  const [checkedShoppingItems, setCheckedShoppingItems] = useState(new Set())
  const [stock, setStock] = useState(() => readCache(STOCK_CACHE_KEY) || [])
  const [weekLoading, setWeekLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [shoppingLoading, setShoppingLoading] = useState(false)
  const [loadedShoppingWeekId, setLoadedShoppingWeekId] = useState(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [error, setError] = useState('')

  // 週を切り替えたとき、前の週のレスポンスが後から届いて上書きするのを防ぐ
  const activeWeekIdRef = useRef(weekId)

  const loadStock = useCallback(async () => {
    setStockLoading(true)
    try {
      const res = await gasApi.getStockIngredients()
      const ingredients = res.ingredients || []
      setStock(ingredients)
      writeCache(STOCK_CACHE_KEY, ingredients)
    } catch (e) {
      setError(e.message)
    } finally {
      setStockLoading(false)
    }
  }, [])

  const loadWeek = useCallback(async (id) => {
    activeWeekIdRef.current = id
    // キャッシュがあれば先に描画してしまい、通信は裏で走らせる
    setWeekData(readCache(weekCacheKey(id)) || EMPTY_WEEK)
    setWeekLoading(true)
    setError('')
    try {
      const res = await gasApi.getWeek(id)
      if (activeWeekIdRef.current !== id) return
      const next = pickWeek(res)
      setWeekData(next)
      writeCache(weekCacheKey(id), next)
      if (Array.isArray(res.stock)) {
        // 新しいGASは手持ち食材も同梱で返すため、起動時のリクエストは1本で済む
        setStock(res.stock)
        writeCache(STOCK_CACHE_KEY, res.stock)
      } else {
        // GASが未デプロイ（旧版）のときのフォールバック
        loadStock()
      }
    } catch (e) {
      setError(e.message)
    } finally {
      if (activeWeekIdRef.current === id) setWeekLoading(false)
    }
  }, [loadStock])

  const loadShoppingList = useCallback(async (id) => {
    const cached = readCache(shoppingCacheKey(id))
    if (cached) {
      setShoppingGroups(cached.groups || [])
      setCheckedShoppingItems(new Set(cached.checked || []))
    }
    setShoppingLoading(true)
    try {
      const res = await gasApi.getShoppingList(id)
      const groups = res.groups || []
      const checked = res.checked || []
      setShoppingGroups(groups)
      setCheckedShoppingItems(new Set(checked))
      setLoadedShoppingWeekId(id)
      writeCache(shoppingCacheKey(id), { groups, checked })
    } catch (e) {
      setError(e.message)
    } finally {
      setShoppingLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isGasReady()) return
    loadWeek(weekId)
  }, [weekId, loadWeek])

  useEffect(() => {
    if (!isGasReady() || tab !== 'shopping') return
    if (loadedShoppingWeekId === weekId) return
    loadShoppingList(weekId)
  }, [tab, weekId, loadedShoppingWeekId, loadShoppingList])

  // 楽観更新もレスポンス反映も、キャッシュへ書き戻して次回起動時に最新が出るようにする
  const setAndCacheWeek = (res) => {
    const next = pickWeek(res)
    setWeekData(next)
    writeCache(weekCacheKey(weekId), next)
    return next
  }

  const updateAndCacheWeek = (updater) => {
    setWeekData((prev) => {
      const next = updater(prev)
      writeCache(weekCacheKey(weekId), next)
      return next
    })
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await gasApi.generateWeek(weekId)
      setAndCacheWeek(res)
      setLoadedShoppingWeekId(null)
      setGenerating(false)
      setShowReveal(true)
      setTimeout(() => setShowReveal(false), REVEAL_DURATION_MS)
    } catch (e) {
      setError(e.message)
      setGenerating(false)
    }
  }

  const handleShiftWeek = (delta) => setWeekId((id) => shiftWeekId(id, delta))

  const handleChooseDish = async (dayLabel, dishId) => {
    updateAndCacheWeek((prev) => ({
      ...prev,
      weekPlan: prev.weekPlan.map((d) => {
        if (d.day_label !== dayLabel) return d
        const target = d.dishes.find((dish) => dish.dish_id === dishId)
        if (!target) return d
        const wasChosen = target.chosen === 'true' || target.chosen === true
        return {
          ...d,
          dishes: d.dishes.map((dish) => {
            if (dish.kind !== target.kind) return dish
            return { ...dish, chosen: !wasChosen && dish.dish_id === dishId ? 'true' : '' }
          }),
        }
      }),
    }))
    setLoadedShoppingWeekId(null)
    try {
      await gasApi.setChosenDish(dishId)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSetPreference = async (dish, dayLabel, preference) => {
    const dishIngredients = weekData.ingredients
      .filter((ing) => ing.dish_id === dish.dish_id)
      .map((ing) => ({ name: ing.ingredient_name, amount: ing.amount }))

    updateAndCacheWeek((prev) => ({
      ...prev,
      preferences: [...prev.preferences, { dish_name: dish.name, preference, week_id: weekId, day_label: dayLabel, dish_id: dish.dish_id }],
    }))
    try {
      const res = await gasApi.setPreference(dish.name, preference, weekId, dayLabel, dish.dish_id, dish.kind, dish.recipe, dishIngredients)
      updateAndCacheWeek((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddDish = async (dayLabel, kind, payload) => {
    try {
      const res = await gasApi.addDish(weekId, dayLabel, kind, payload.name, payload.recipe, payload.ingredients)
      setAndCacheWeek(res)
      setLoadedShoppingWeekId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddDishFromFavorite = async (dayLabel, kind, favId) => {
    try {
      const res = await gasApi.addDishFromFavorite(weekId, dayLabel, favId, kind)
      setAndCacheWeek(res)
      setLoadedShoppingWeekId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleMoveDish = async (dishId, targetDayLabel) => {
    try {
      const res = await gasApi.moveDish(dishId, targetDayLabel)
      setAndCacheWeek(res)
      setLoadedShoppingWeekId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddTag = async (label) => {
    try {
      await gasApi.addTag(label)
      loadWeek(weekId)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleRemoveTag = async (tagId) => {
    try {
      await gasApi.removeTag(tagId)
      loadWeek(weekId)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddStock = async (name, quantity) => {
    try {
      const res = await gasApi.addStockIngredient(name, quantity)
      setStock(res.ingredients || [])
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSubtractStock = async (name, quantity) => {
    try {
      const res = await gasApi.subtractStockIngredient(name, quantity)
      setStock(res.ingredients || [])
    } catch (e) {
      setError(e.message)
    }
  }

  const handleCheckShoppingItem = (groupLabel, item) => {
    const key = `${groupLabel}__${item.ingredient_name}`
    const wasChecked = checkedShoppingItems.has(key)
    if (wasChecked) {
      setCheckedShoppingItems((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      handleSubtractStock(item.ingredient_name, item.amount)
      gasApi.uncheckShoppingItem(weekId, groupLabel, item.ingredient_name).catch((e) => setError(e.message))
    } else {
      setCheckedShoppingItems((prev) => new Set(prev).add(key))
      handleAddStock(item.ingredient_name, item.amount)
      gasApi.checkShoppingItem(weekId, groupLabel, item.ingredient_name).catch((e) => setError(e.message))
    }
  }

  const handleStockQuantityChange = (id, quantity) => {
    setStock((prev) => prev.map((i) => i.id === id ? { ...i, quantity } : i))
  }

  const handleStockQuantityCommit = async (id, quantity) => {
    try {
      await gasApi.updateStockIngredientQuantity(id, quantity)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleRemoveStock = async (id) => {
    setStock((prev) => prev.filter((i) => i.id !== id))
    try {
      await gasApi.removeStockIngredient(id)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSetCheatDay = async (cheatDay) => {
    updateAndCacheWeek((prev) => ({ ...prev, cheatDay }))
    try {
      await gasApi.setCheatDay(cheatDay)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleExtractDishFromImage = async (images) => {
    try {
      return await gasApi.extractDishFromImage(images)
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const handleExtractDishFromText = async (text) => {
    try {
      return await gasApi.extractDishFromText(text)
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const handleAddCandidate = async (main, recipe, ingredients, category, thumbnail) => {
    try {
      const res = await gasApi.addCandidate(main, recipe, ingredients, category, thumbnail)
      updateAndCacheWeek((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const handleUpdateCandidate = async (favId, main, recipe, ingredients, category, thumbnail, removeImage) => {
    try {
      const res = await gasApi.updateCandidate(favId, main, recipe, ingredients, category, thumbnail, removeImage)
      updateAndCacheWeek((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const handleRemoveCandidate = async (favId) => {
    try {
      const res = await gasApi.removeCandidate(favId)
      updateAndCacheWeek((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
    }
  }

  // キャッシュ済みの献立が既に出ているときは全画面オーバーレイで隠さず、控えめな「更新中」表示にする
  const hasWeekContent = weekData.weekPlan.length > 0
  const blockingWeekLoad = weekLoading && !hasWeekContent
  const refreshing = (weekLoading && hasWeekContent) || (shoppingLoading && shoppingGroups.length > 0)

  const overlayPhase = showReveal ? 'reveal' : generating ? 'generating' : blockingWeekLoad ? 'loading' : null

  return (
    <div className="app">
      <LoadingOverlay phase={overlayPhase} />

      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="app-header__icon" width="72" height="72" />
        <h1>料理の鉄人</h1>
        {refreshing && <span className="refresh-chip" role="status">更新中…</span>}
      </header>

      {!isGasReady() && (
        <p className="empty-msg">VITE_GAS_URLが設定されていません（.env.localを確認してください）</p>
      )}

      {error && <p className="error-msg">{error}</p>}

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'plan' && (
          <WeekPlanView
            weekId={weekId}
            weekPlan={weekData.weekPlan}
            preferences={weekData.preferences}
            ingredients={weekData.ingredients}
            favorites={weekData.favorites}
            loading={blockingWeekLoad || generating}
            generating={generating}
            onGenerate={handleGenerate}
            onShiftWeek={handleShiftWeek}
            onChooseDish={handleChooseDish}
            onSetPreference={handleSetPreference}
            onAddDish={handleAddDish}
            onAddDishFromFavorite={handleAddDishFromFavorite}
            onMoveDish={handleMoveDish}
          />
        )}
        {tab === 'shopping' && (
          <ShoppingListView
            groups={shoppingGroups}
            checkedItems={checkedShoppingItems}
            loading={shoppingLoading && shoppingGroups.length === 0}
            stock={stock}
            stockLoading={stockLoading}
            onCheckItem={handleCheckShoppingItem}
            onAddStock={handleAddStock}
            onQuantityChange={handleStockQuantityChange}
            onQuantityCommit={handleStockQuantityCommit}
            onRemoveStock={handleRemoveStock}
            onRegenerate={() => loadShoppingList(weekId)}
          />
        )}
        {tab === 'candidates' && (
          <CandidatesView
            favorites={weekData.favorites}
            onExtract={handleExtractDishFromImage}
            onExtractText={handleExtractDishFromText}
            onAddCandidate={handleAddCandidate}
            onUpdateCandidate={handleUpdateCandidate}
            onRemoveCandidate={handleRemoveCandidate}
          />
        )}
        {tab === 'settings' && (
          <SettingsView
            styleTags={weekData.styleTags}
            cheatDay={weekData.cheatDay}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onSetCheatDay={handleSetCheatDay}
          />
        )}
      </main>
    </div>
  )
}
