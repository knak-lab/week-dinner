import { useEffect, useState, useCallback } from 'react'
import { gasApi, isGasReady } from './utils/gasApi'
import { currentWeekId, shiftWeekId } from './utils/weekUtils'
import WeekPlanView from './components/WeekPlanView'
import ShoppingListView from './components/ShoppingListView'
import SettingsView from './components/SettingsView'
import CandidatesView from './components/CandidatesView'
import LoadingOverlay from './components/LoadingOverlay'

const REVEAL_DURATION_MS = 2500

const TABS = [
  { id: 'plan', label: '献立' },
  { id: 'shopping', label: '買い物・食材' },
  { id: 'candidates', label: '候補' },
  { id: 'settings', label: '設定' },
]

export default function App() {
  const [weekId, setWeekId] = useState(currentWeekId())
  const [tab, setTab] = useState('plan')
  const [weekData, setWeekData] = useState({ weekPlan: [], ingredients: [], styleTags: [], preferences: [], favorites: [], cheatDay: '' })
  const [shoppingGroups, setShoppingGroups] = useState([])
  const [checkedShoppingItems, setCheckedShoppingItems] = useState(new Set())
  const [stock, setStock] = useState([])
  const [weekLoading, setWeekLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [shoppingLoading, setShoppingLoading] = useState(false)
  const [loadedShoppingWeekId, setLoadedShoppingWeekId] = useState(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [error, setError] = useState('')

  const loadWeek = useCallback(async (id) => {
    setWeekLoading(true)
    setError('')
    try {
      const res = await gasApi.getWeek(id)
      setWeekData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setWeekLoading(false)
    }
  }, [])

  const loadShoppingList = useCallback(async (id) => {
    setShoppingLoading(true)
    try {
      const res = await gasApi.getShoppingList(id)
      setShoppingGroups(res.groups || [])
      setCheckedShoppingItems(new Set(res.checked || []))
      setLoadedShoppingWeekId(id)
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

  const loadStock = useCallback(async () => {
    setStockLoading(true)
    try {
      const res = await gasApi.getStockIngredients()
      setStock(res.ingredients || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setStockLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isGasReady()) return
    loadStock()
  }, [loadStock])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await gasApi.generateWeek(weekId)
      setWeekData(res)
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
    setWeekData((prev) => ({
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

    setWeekData((prev) => ({
      ...prev,
      preferences: [...prev.preferences, { dish_name: dish.name, preference, week_id: weekId, day_label: dayLabel, dish_id: dish.dish_id }],
    }))
    try {
      const res = await gasApi.setPreference(dish.name, preference, weekId, dayLabel, dish.dish_id, dish.kind, dish.recipe, dishIngredients)
      setWeekData((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddDish = async (dayLabel, kind, payload) => {
    try {
      const res = await gasApi.addDish(weekId, dayLabel, kind, payload.name, payload.recipe, payload.ingredients)
      setWeekData(res)
      setLoadedShoppingWeekId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddDishFromFavorite = async (dayLabel, kind, favId) => {
    try {
      const res = await gasApi.addDishFromFavorite(weekId, dayLabel, favId, kind)
      setWeekData(res)
      setLoadedShoppingWeekId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleMoveDish = async (dishId, targetDayLabel) => {
    try {
      const res = await gasApi.moveDish(dishId, targetDayLabel)
      setWeekData(res)
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

  const handleCheckShoppingItem = (groupLabel, item) => {
    const key = `${groupLabel}__${item.ingredient_name}`
    const wasChecked = checkedShoppingItems.has(key)
    if (wasChecked) {
      setCheckedShoppingItems((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
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
    setWeekData((prev) => ({ ...prev, cheatDay }))
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
      setWeekData((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const handleUpdateCandidate = async (favId, main, recipe, ingredients, category, thumbnail, removeImage) => {
    try {
      const res = await gasApi.updateCandidate(favId, main, recipe, ingredients, category, thumbnail, removeImage)
      setWeekData((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const handleRemoveCandidate = async (favId) => {
    try {
      const res = await gasApi.removeCandidate(favId)
      setWeekData((prev) => ({ ...prev, favorites: res.favorites }))
    } catch (e) {
      setError(e.message)
    }
  }

  const overlayPhase = showReveal ? 'reveal' : generating ? 'generating' : weekLoading ? 'loading' : null

  return (
    <div className="app">
      <LoadingOverlay phase={overlayPhase} />

      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}icon-512.png`} alt="" className="app-header__icon" />
        <h1>料理の鉄人</h1>
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
            loading={weekLoading || generating}
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
            loading={shoppingLoading}
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
