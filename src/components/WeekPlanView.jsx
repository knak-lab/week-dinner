import { useState } from 'react'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

const dayLabelFull_ = (label) => `${label}曜`

const KIND_LABEL = { main: '主菜', side: '副菜' }

const favoriteMatchesKind_ = (f, kind) => (kind === 'side' ? f.category === 'side' : f.category !== 'side')

function RecipeModal({ dayLabel, kind, name, imageUrl, recipe, ingredients, onClose }) {
  return (
    <div className="recipe-modal-backdrop" onClick={onClose}>
      <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-modal__header">
          <div>
            <h3 className="recipe-modal__title">{dayLabelFull_(dayLabel)}：{KIND_LABEL[kind] || ''}</h3>
            <p className="recipe-modal__main-line">{name}</p>
          </div>
          <button className="recipe-modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>

        {imageUrl && <img src={imageUrl} alt="" className="recipe-modal__thumb" />}

        {ingredients.length > 0 && (
          <>
            <h4 className="recipe-modal__section-title">材料</h4>
            <ul className="recipe-modal__ingredient-list">
              {ingredients.map((ing) => (
                <li key={ing.ingredient_name}>
                  <span>{ing.ingredient_name}</span>
                  <span className="recipe-modal__ingredient-amount">{ing.amount}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h4 className="recipe-modal__section-title">作り方</h4>
        <div className="recipe-modal__body">{recipe || 'レシピが登録されていません。'}</div>
      </div>
    </div>
  )
}

function AddChoiceModal({ dayLabel, kind, hasFavorites, onSelectManual, onSelectFavorite, onClose }) {
  return (
    <div className="recipe-modal-backdrop" onClick={onClose}>
      <div className="recipe-modal recipe-modal--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-modal__header">
          <h3 className="recipe-modal__title">{dayLabelFull_(dayLabel)}に{KIND_LABEL[kind]}を追加</h3>
          <button className="recipe-modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="choice-list">
          <button className="choice-btn" onClick={onSelectManual}>手動で登録</button>
          <button className="choice-btn" onClick={onSelectFavorite} disabled={!hasFavorites}>
            お気に入りから選ぶ{!hasFavorites && '（まだありません）'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ManualDishModal({ dayLabel, kind, onSave, onClose }) {
  const [name, setName] = useState('')
  const [recipe, setRecipe] = useState('')
  const [ingredientRows, setIngredientRows] = useState([{ name: '', amount: '' }])

  const updateIngredient = (idx, field, value) => {
    setIngredientRows((prev) => prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)))
  }
  const addIngredientRow = () => setIngredientRows((prev) => [...prev, { name: '', amount: '' }])
  const removeIngredientRow = (idx) => setIngredientRows((prev) => prev.filter((_, i) => i !== idx))

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const cleanIngredients = ingredientRows
      .filter((ing) => ing.name.trim())
      .map((ing) => ({ name: ing.name.trim(), amount: ing.amount.trim() }))
    onSave({ name: name.trim(), recipe: recipe.trim(), ingredients: cleanIngredients })
  }

  return (
    <div className="recipe-modal-backdrop" onClick={onClose}>
      <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-modal__header">
          <h3 className="recipe-modal__title">{dayLabelFull_(dayLabel)}に{KIND_LABEL[kind]}を手動で登録</h3>
          <button className="recipe-modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <form className="manual-form" onSubmit={submit}>
          <label className="manual-form__label">{KIND_LABEL[kind]}名</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：鮭の塩麹焼き" required />

          <label className="manual-form__label">材料</label>
          <div className="manual-form__ingredients">
            {ingredientRows.map((ing, idx) => (
              <div className="manual-form__ing-row" key={idx}>
                <input value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)} placeholder="食材名" />
                <input value={ing.amount} onChange={(e) => updateIngredient(idx, 'amount', e.target.value)} placeholder="分量" />
                <button type="button" className="manual-form__remove-ing" onClick={() => removeIngredientRow(idx)} aria-label="削除">×</button>
              </div>
            ))}
            <button type="button" className="manual-form__add-ing" onClick={addIngredientRow}>+ 材料を追加</button>
          </div>

          <label className="manual-form__label">作り方</label>
          <textarea value={recipe} onChange={(e) => setRecipe(e.target.value)} rows={5} placeholder={'1. …\n2. …'} />

          <button type="submit" className="manual-form__submit">追加する</button>
        </form>
      </div>
    </div>
  )
}

function favoriteIngredientNames_(f) {
  try {
    const parsed = JSON.parse(f.ingredients_json || '[]')
    return Array.isArray(parsed) ? parsed.map((ing) => ing.name || '').filter(Boolean) : []
  } catch (e) {
    return []
  }
}

function FavoritePickerModal({ dayLabel, kind, favorites, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [ingredientFilter, setIngredientFilter] = useState('')
  const q = search.trim().toLowerCase()
  const iq = ingredientFilter.trim().toLowerCase()
  const scoped = favorites.filter((f) => favoriteMatchesKind_(f, kind))
  const filtered = scoped.filter((f) => {
    if (q && !f.main.toLowerCase().includes(q)) return false
    if (iq && !favoriteIngredientNames_(f).some((name) => name.toLowerCase().includes(iq))) return false
    return true
  })

  return (
    <div className="recipe-modal-backdrop" onClick={onClose}>
      <div className="recipe-modal recipe-modal--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-modal__header">
          <h3 className="recipe-modal__title">{dayLabelFull_(dayLabel)}に{KIND_LABEL[kind]}をお気に入りから追加</h3>
          <button className="recipe-modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        {scoped.length === 0 ? (
          <p className="empty-msg">{KIND_LABEL[kind]}のお気に入りがまだありません。</p>
        ) : (
          <>
            <div className="favorite-picker__filters">
              <input
                type="search"
                className="candidate-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="料理名で検索"
              />
              <input
                type="search"
                className="candidate-search"
                value={ingredientFilter}
                onChange={(e) => setIngredientFilter(e.target.value)}
                placeholder="食材で絞り込む（例：鶏むね肉）"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="empty-msg">該当するお気に入りがありません。</p>
            ) : (
              <ul className="favorite-list">
                {filtered.map((f) => (
                  <li key={f.fav_id} className="favorite-list__item">
                    {f.image_url && <img src={f.image_url} alt="" className="favorite-list__thumb" />}
                    <div className="favorite-list__main">{f.main}</div>
                    <button className="choose-btn" onClick={() => onSelect(f.fav_id)}>追加</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MoveDishModal({ currentDayLabel, onSelectDay, onClose }) {
  return (
    <div className="recipe-modal-backdrop" onClick={onClose}>
      <div className="recipe-modal recipe-modal--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-modal__header">
          <h3 className="recipe-modal__title">どの曜日に移動しますか？</h3>
          <button className="recipe-modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="day-picker">
          {DAY_LABELS.map((d) => (
            <button
              key={d}
              className="day-picker__btn"
              onClick={() => onSelectDay(d)}
              disabled={d === currentDayLabel}
            >
              {dayLabelFull_(d)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function dishPreference(preferences, dishName) {
  if (!dishName) return null
  const rows = preferences.filter((p) => p.dish_name === dishName)
  if (rows.length === 0) return null
  return rows[rows.length - 1].preference
}

function DishCard({ day, dish, index, preferences, onChooseDish, onSetPreference, onShowRecipe, onOpenMove }) {
  const isChosen = dish.chosen === 'true' || dish.chosen === true
  const pref = dishPreference(preferences, dish.name)

  return (
    <div className={`variant${isChosen ? ' variant--chosen' : ''}`}>
      <div className="variant__header">
        <span className="variant__badge">候補{index + 1}</span>
        <div className="variant__actions">
          <button className="recipe-btn" onClick={() => onShowRecipe(day, dish)} disabled={!dish.recipe}>
            レシピ
          </button>
          <button className="move-btn" onClick={() => onOpenMove(dish, day.day_label)}>
            移動
          </button>
          <button
            className={`choose-btn${isChosen ? ' choose-btn--active' : ''}`}
            onClick={() => onChooseDish(day.day_label, dish.dish_id)}
          >
            {isChosen ? '作った' : 'これをつくる'}
          </button>
        </div>
      </div>
      <div className="variant__body">
        {dish.image_url && <img src={dish.image_url} alt="" className="variant__thumb" />}
        <div className="variant__main">{dish.name}</div>
      </div>
      {isChosen && (
        <div className="variant__pref">
          <button
            className={`pref-btn${pref === 'like' ? ' pref-btn--active' : ''}`}
            onClick={() => onSetPreference(dish, day.day_label, 'like')}
          >
            👍 好き
          </button>
          <button
            className={`pref-btn${pref === 'dislike' ? ' pref-btn--active' : ''}`}
            onClick={() => onSetPreference(dish, day.day_label, 'dislike')}
          >
            👎 苦手
          </button>
        </div>
      )}
    </div>
  )
}

function DishSection({ kind, day, dishes, preferences, onChooseDish, onSetPreference, onShowRecipe, onOpenMove, onOpenAddChoice }) {
  return (
    <div className="day-card__kind-section">
      <div className="day-card__kind-header">{KIND_LABEL[kind]}</div>
      {dishes.length > 0 && (
        <div className="day-card__variants">
          {dishes.map((dish, idx) => (
            <DishCard
              key={dish.dish_id}
              day={day}
              dish={dish}
              index={idx}
              preferences={preferences}
              onChooseDish={onChooseDish}
              onSetPreference={onSetPreference}
              onShowRecipe={onShowRecipe}
              onOpenMove={onOpenMove}
            />
          ))}
        </div>
      )}
      <button className="add-dish-btn" onClick={() => onOpenAddChoice(day.day_label, kind)}>
        + {KIND_LABEL[kind]}を追加
      </button>
    </div>
  )
}

function DayCard({ day, preferences, onChooseDish, onSetPreference, onShowRecipe, onOpenMove, onOpenAddChoice }) {
  const isCheat = day.cheat === 'true' || day.cheat === true
  const tags = (day.tags || '').split(',').filter(Boolean)
  const dishes = day.dishes || []
  const mainDishes = dishes.filter((d) => d.kind !== 'side')
  const sideDishes = dishes.filter((d) => d.kind === 'side')

  return (
    <div className={`day-card${isCheat ? ' day-card--cheat' : ''}`}>
      <div className="day-card__header">
        <span className="day-card__label">{dayLabelFull_(day.day_label)}</span>
        <span className="day-card__date">{day.date}</span>
        {tags.length > 0 && (
          <span className="day-card__tags">
            {tags.map((t) => <span key={t} className="tag-badge">{t}</span>)}
          </span>
        )}
      </div>

      {isCheat && dishes.length === 0 && (
        <div className="day-card__cheat-badge">チートデイ（外食・惣菜）</div>
      )}

      <DishSection
        kind="main" day={day} dishes={mainDishes} preferences={preferences}
        onChooseDish={onChooseDish} onSetPreference={onSetPreference}
        onShowRecipe={onShowRecipe} onOpenMove={onOpenMove} onOpenAddChoice={onOpenAddChoice}
      />
      <DishSection
        kind="side" day={day} dishes={sideDishes} preferences={preferences}
        onChooseDish={onChooseDish} onSetPreference={onSetPreference}
        onShowRecipe={onShowRecipe} onOpenMove={onOpenMove} onOpenAddChoice={onOpenAddChoice}
      />
    </div>
  )
}

export default function WeekPlanView({
  weekId, weekPlan, preferences, ingredients, favorites, loading, generating,
  onGenerate, onShiftWeek, onChooseDish, onSetPreference, onAddDish, onAddDishFromFavorite, onMoveDish,
}) {
  const [recipeModal, setRecipeModal] = useState(null)
  const [addChoiceModal, setAddChoiceModal] = useState(null)
  const [manualDishModal, setManualDishModal] = useState(null)
  const [favoritePickerModal, setFavoritePickerModal] = useState(null)
  const [moveDishModal, setMoveDishModal] = useState(null)

  const handleShowRecipe = (day, dish) => {
    const dishIngredients = ingredients.filter((ing) => ing.dish_id === dish.dish_id)
    setRecipeModal({
      dayLabel: day.day_label, kind: dish.kind, name: dish.name, imageUrl: dish.image_url,
      recipe: dish.recipe, ingredients: dishIngredients,
    })
  }

  const openAddChoice = (dayLabel, kind) => setAddChoiceModal({ dayLabel, kind })

  const openMove = (dish, dayLabel) => setMoveDishModal({ dishId: dish.dish_id, dayLabel })

  const handleSelectManual = () => {
    const { dayLabel, kind } = addChoiceModal
    setAddChoiceModal(null)
    setManualDishModal({ dayLabel, kind })
  }

  const handleSelectFavorite = () => {
    const { dayLabel, kind } = addChoiceModal
    setAddChoiceModal(null)
    setFavoritePickerModal({ dayLabel, kind })
  }

  const handleManualSave = (payload) => {
    onAddDish(manualDishModal.dayLabel, manualDishModal.kind, payload)
    setManualDishModal(null)
  }

  const handleFavoriteSelect = (favId) => {
    onAddDishFromFavorite(favoritePickerModal.dayLabel, favoritePickerModal.kind, favId)
    setFavoritePickerModal(null)
  }

  const handleMoveSelectDay = (targetDayLabel) => {
    onMoveDish(moveDishModal.dishId, targetDayLabel)
    setMoveDishModal(null)
  }

  return (
    <div>
      <div className="week-toolbar">
        <button className="week-nav-btn" onClick={() => onShiftWeek(-1)}>← 前の週</button>
        <span className="week-toolbar__label">{weekId} の週</span>
        <button className="week-nav-btn" onClick={() => onShiftWeek(1)}>次の週 →</button>
      </div>

      <button className="generate-btn" onClick={onGenerate} disabled={loading}>
        {generating ? '生成中…' : weekPlan.length > 0 ? 'この週の献立を作り直す' : 'この週の献立を作る'}
      </button>

      {weekPlan.length === 0 && !loading && (
        <p className="empty-msg">まだこの週の献立がありません。「献立を作る」を押してください。</p>
      )}

      {!loading && (
        <div className="day-list">
          {weekPlan.map((day) => (
            <DayCard
              key={day.day_label}
              day={day}
              preferences={preferences}
              onChooseDish={onChooseDish}
              onSetPreference={onSetPreference}
              onShowRecipe={handleShowRecipe}
              onOpenMove={openMove}
              onOpenAddChoice={openAddChoice}
            />
          ))}
        </div>
      )}

      {recipeModal && <RecipeModal {...recipeModal} onClose={() => setRecipeModal(null)} />}

      {addChoiceModal && (
        <AddChoiceModal
          dayLabel={addChoiceModal.dayLabel}
          kind={addChoiceModal.kind}
          hasFavorites={favorites.some((f) => favoriteMatchesKind_(f, addChoiceModal.kind))}
          onSelectManual={handleSelectManual}
          onSelectFavorite={handleSelectFavorite}
          onClose={() => setAddChoiceModal(null)}
        />
      )}

      {manualDishModal && (
        <ManualDishModal
          dayLabel={manualDishModal.dayLabel}
          kind={manualDishModal.kind}
          onSave={handleManualSave}
          onClose={() => setManualDishModal(null)}
        />
      )}

      {favoritePickerModal && (
        <FavoritePickerModal
          dayLabel={favoritePickerModal.dayLabel}
          kind={favoritePickerModal.kind}
          favorites={favorites}
          onSelect={handleFavoriteSelect}
          onClose={() => setFavoritePickerModal(null)}
        />
      )}

      {moveDishModal && (
        <MoveDishModal
          currentDayLabel={moveDishModal.dayLabel}
          onSelectDay={handleMoveSelectDay}
          onClose={() => setMoveDishModal(null)}
        />
      )}
    </div>
  )
}
