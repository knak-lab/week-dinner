function dishPreference(preferences, dishName) {
  if (!dishName) return null
  const rows = preferences.filter((p) => p.dish_name === dishName)
  if (rows.length === 0) return null
  return rows[rows.length - 1].preference
}

function DayCard({ day, preferences, onChooseVariant, onSetPreference }) {
  const isCheat = day.cheat === 'true' || day.cheat === true
  const tags = (day.tags || '').split(',').filter(Boolean)
  const chosen = day.chosen_variant || ''

  if (isCheat) {
    return (
      <div className="day-card day-card--cheat">
        <div className="day-card__header">
          <span className="day-card__label">{day.day_label}</span>
          <span className="day-card__date">{day.date}</span>
        </div>
        <div className="day-card__cheat-badge">チートデイ（外食・惣菜）</div>
      </div>
    )
  }

  const variants = [
    { key: 'A', main: day.main_A, side: day.side_A },
    { key: 'B', main: day.main_B, side: day.side_B },
  ]

  return (
    <div className="day-card">
      <div className="day-card__header">
        <span className="day-card__label">{day.day_label}</span>
        <span className="day-card__date">{day.date}</span>
        {tags.length > 0 && (
          <span className="day-card__tags">
            {tags.map((t) => <span key={t} className="tag-badge">{t}</span>)}
          </span>
        )}
      </div>

      <div className="day-card__variants">
        {variants.map((v) => {
          if (!v.main) return null
          const isChosen = chosen === v.key
          const pref = dishPreference(preferences, v.main)
          return (
            <div key={v.key} className={`variant${isChosen ? ' variant--chosen' : ''}`}>
              <div className="variant__header">
                <span className="variant__badge">案{v.key}</span>
                <button
                  className={`choose-btn${isChosen ? ' choose-btn--active' : ''}`}
                  onClick={() => onChooseVariant(day.day_label, v.key)}
                >
                  {isChosen ? '作った' : 'これを作る'}
                </button>
              </div>
              <div className="variant__main">{v.main}</div>
              <div className="variant__side">{v.side}</div>
              {isChosen && (
                <div className="variant__pref">
                  <button
                    className={`pref-btn${pref === 'like' ? ' pref-btn--active' : ''}`}
                    onClick={() => onSetPreference(v.main, 'like', day.day_label, v.key)}
                  >
                    👍 好き
                  </button>
                  <button
                    className={`pref-btn${pref === 'dislike' ? ' pref-btn--active' : ''}`}
                    onClick={() => onSetPreference(v.main, 'dislike', day.day_label, v.key)}
                  >
                    👎 苦手
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WeekPlanView({ weekId, weekPlan, preferences, loading, onGenerate, onShiftWeek, onChooseVariant, onSetPreference }) {
  return (
    <div>
      <div className="week-toolbar">
        <button className="week-nav-btn" onClick={() => onShiftWeek(-1)}>← 前の週</button>
        <span className="week-toolbar__label">{weekId} の週</span>
        <button className="week-nav-btn" onClick={() => onShiftWeek(1)}>次の週 →</button>
      </div>

      <button className="generate-btn" onClick={onGenerate} disabled={loading}>
        {loading ? '生成中…' : weekPlan.length > 0 ? 'この週の献立を作り直す' : 'この週の献立を作る'}
      </button>

      {weekPlan.length === 0 && !loading && (
        <p className="empty-msg">まだこの週の献立がありません。「献立を作る」を押してください。</p>
      )}

      <div className="day-list">
        {weekPlan.map((day) => (
          <DayCard
            key={day.day_label}
            day={day}
            preferences={preferences}
            onChooseVariant={onChooseVariant}
            onSetPreference={onSetPreference}
          />
        ))}
      </div>
    </div>
  )
}
