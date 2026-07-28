import { useEffect, useState, useCallback } from 'react'
import { gasApi, isGasReady } from './utils/gasApi'
import { currentWeekId, shiftWeekId } from './utils/weekUtils'
import WeekPlanView from './components/WeekPlanView'
import ShoppingListView from './components/ShoppingListView'
import SettingsView from './components/SettingsView'

const TABS = [
  { id: 'plan', label: '献立' },
  { id: 'shopping', label: '買い物リスト' },
  { id: 'settings', label: '設定' },
]

export default function App() {
  const [weekId, setWeekId] = useState(currentWeekId())
  const [tab, setTab] = useState('plan')
  const [weekData, setWeekData] = useState({ weekPlan: [], ingredients: [], styleTags: [], preferences: [], cheatDay: '' })
  const [shoppingGroups, setShoppingGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [shoppingLoading, setShoppingLoading] = useState(false)
  const [error, setError] = useState('')

  const loadWeek = useCallback(async (id) => {
    setLoading(true)
    setError('')
    try {
      const res = await gasApi.getWeek(id)
      setWeekData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadShoppingList = useCallback(async (id) => {
    setShoppingLoading(true)
    try {
      const res = await gasApi.getShoppingList(id)
      setShoppingGroups(res.groups || [])
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
    loadShoppingList(weekId)
  }, [tab, weekId, loadShoppingList])

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await gasApi.generateWeek(weekId)
      setWeekData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleShiftWeek = (delta) => setWeekId((id) => shiftWeekId(id, delta))

  const handleChooseVariant = async (dayLabel, variant) => {
    setWeekData((prev) => ({
      ...prev,
      weekPlan: prev.weekPlan.map((d) => d.day_label === dayLabel ? { ...d, chosen_variant: variant } : d),
    }))
    try {
      await gasApi.setChosenVariant(weekId, dayLabel, variant)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSetPreference = async (dishName, preference, dayLabel, variant) => {
    setWeekData((prev) => ({
      ...prev,
      preferences: [...prev.preferences, { dish_name: dishName, preference, week_id: weekId, day_label: dayLabel, variant }],
    }))
    try {
      await gasApi.setPreference(dishName, preference, weekId, dayLabel, variant)
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

  const handleSetCheatDay = async (cheatDay) => {
    setWeekData((prev) => ({ ...prev, cheatDay }))
    try {
      await gasApi.setCheatDay(cheatDay)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>週の晩ごはん</h1>
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
            loading={loading}
            onGenerate={handleGenerate}
            onShiftWeek={handleShiftWeek}
            onChooseVariant={handleChooseVariant}
            onSetPreference={handleSetPreference}
          />
        )}
        {tab === 'shopping' && (
          <ShoppingListView groups={shoppingGroups} loading={shoppingLoading} />
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
