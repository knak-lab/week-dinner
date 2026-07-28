import { useState } from 'react'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export default function SettingsView({ styleTags, cheatDay, onAddTag, onRemoveTag, onSetCheatDay }) {
  const [newTag, setNewTag] = useState('')

  const submitTag = (e) => {
    e.preventDefault()
    const label = newTag.trim()
    if (!label) return
    onAddTag(label)
    setNewTag('')
  }

  return (
    <div className="settings-view">
      <section className="settings-section">
        <h3>基本スタイル</h3>
        <form onSubmit={submitTag} className="tag-form">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="例：油控えめ"
          />
          <button type="submit">追加</button>
        </form>
        <div className="tag-list">
          {styleTags.map((t) => (
            <span key={t.tag_id} className="tag-chip">
              {t.label}
              <button className="tag-chip__remove" onClick={() => onRemoveTag(t.tag_id)}>×</button>
            </span>
          ))}
          {styleTags.length === 0 && <span className="empty-msg">まだタグがありません</span>}
        </div>
      </section>

      <section className="settings-section">
        <h3>チートデイ</h3>
        <select value={cheatDay} onChange={(e) => onSetCheatDay(e.target.value)}>
          <option value="">なし</option>
          {DAY_LABELS.map((d) => <option key={d} value={d}>{d}曜日</option>)}
        </select>
      </section>
    </div>
  )
}
