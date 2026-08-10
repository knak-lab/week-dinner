import { useRef, useState } from 'react'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85

function resizeImageToBase64_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        resolve({ dataUrl, base64: dataUrl.split(',')[1] })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function candidateCategory_(f) {
  return f.category === 'side' ? 'side' : 'main'
}

function parseIngredientsJson_(json) {
  try {
    const parsed = JSON.parse(json || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function CandidateForm({ mode, initialValues, onSave, onCancel }) {
  const [category, setCategory] = useState(candidateCategory_(initialValues))
  const [main, setMain] = useState(initialValues.main || '')
  const [recipe, setRecipe] = useState(initialValues.recipe || '')
  const [ingredientRows, setIngredientRows] = useState(
    initialValues.ingredients && initialValues.ingredients.length > 0
      ? initialValues.ingredients.map((ing) => ({ name: ing.name || '', amount: ing.amount || '' }))
      : [{ name: '', amount: '' }]
  )
  const [saving, setSaving] = useState(false)

  const updateIngredient = (idx, field, value) =>
    setIngredientRows((prev) => prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)))
  const addIngredientRow = () => setIngredientRows((prev) => [...prev, { name: '', amount: '' }])
  const removeIngredientRow = (idx) => setIngredientRows((prev) => prev.filter((_, i) => i !== idx))

  const submit = async (e) => {
    e.preventDefault()
    if (!main.trim()) return
    const cleanIngredients = ingredientRows
      .filter((ing) => ing.name.trim())
      .map((ing) => ({ name: ing.name.trim(), amount: ing.amount.trim() }))
    setSaving(true)
    try {
      await onSave({ main: main.trim(), recipe: recipe.trim(), ingredients: cleanIngredients, category })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="candidate-review-form" onSubmit={submit}>
      {initialValues.imageUrl && <img src={initialValues.imageUrl} alt="" className="upload-form__preview" />}

      <label className="manual-form__label">区分</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="main">主菜</option>
        <option value="side">副菜</option>
      </select>

      <label className="manual-form__label">料理名</label>
      <input value={main} onChange={(e) => setMain(e.target.value)} placeholder="例：鮭の塩麹焼き" required />

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

      <div className="candidate-review-form__actions">
        <button type="button" className="candidate-review-form__cancel" onClick={onCancel}>キャンセル</button>
        <button type="submit" className="manual-form__submit" disabled={saving}>
          {saving ? '保存中…' : mode === 'edit' ? '変更を保存' : '候補として保存'}
        </button>
      </div>
    </form>
  )
}

function CandidateListSection({ title, items, onEdit, onRemove }) {
  return (
    <details className="candidate-group">
      <summary>{title}（{items.length}）</summary>
      {items.length === 0 ? (
        <p className="empty-msg">該当する候補がありません。</p>
      ) : (
        <ul className="candidate-list">
          {items.map((f) => (
            <li key={f.fav_id} className="candidate-list__item">
              {f.image_url && <img src={f.image_url} alt="" className="candidate-list__thumb" />}
              <div className="favorite-list__main">{f.main}</div>
              <button className="candidate-list__edit" onClick={() => onEdit(f)}>編集</button>
              <button className="candidate-list__remove" onClick={() => onRemove(f.fav_id)} aria-label="削除">×</button>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

export default function CandidatesView({ favorites, onExtract, onExtractText, onAddCandidate, onUpdateCandidate, onRemoveCandidate }) {
  const [inputMode, setInputMode] = useState('image')
  const [preview, setPreview] = useState(null)
  const [pastedText, setPastedText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setUploadError('')
    setExtracted(null)
    setEditing(null)
    try {
      const resized = await resizeImageToBase64_(file)
      setPreview(resized)
    } catch (err) {
      setUploadError(err.message)
    }
  }

  const handleExtract = async () => {
    if (!preview) return
    setExtracting(true)
    setUploadError('')
    try {
      const res = await onExtract(preview.base64, 'image/jpeg')
      setExtracted(res)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  const handleExtractText = async () => {
    if (!pastedText.trim()) return
    setExtracting(true)
    setUploadError('')
    try {
      const res = await onExtractText(pastedText.trim())
      setExtracted(res)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  const resetUpload = () => {
    setPreview(null)
    setPastedText('')
    setExtracted(null)
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const switchMode = (mode) => {
    setInputMode(mode)
    resetUpload()
    setEditing(null)
  }

  const openEdit = (f) => {
    resetUpload()
    setEditing({ ...f, ingredients: parseIngredientsJson_(f.ingredients_json) })
  }

  const handleSaveNew = async ({ main, recipe, ingredients, category }) => {
    await onAddCandidate(main, recipe, ingredients, extracted ? extracted.imageUrl : '', category)
    resetUpload()
  }

  const handleSaveEdit = async ({ main, recipe, ingredients, category }) => {
    await onUpdateCandidate(editing.fav_id, main, recipe, ingredients, category, editing.image_url || '')
    setEditing(null)
  }

  const q = search.trim().toLowerCase()
  const filtered = favorites.filter((f) => !q || f.main.toLowerCase().includes(q))
  const mains = filtered.filter((f) => candidateCategory_(f) === 'main')
  const sides = filtered.filter((f) => candidateCategory_(f) === 'side')

  return (
    <div className="candidates-view">
      <section className="upload-section">
        <h3 className="section-title">候補を追加</h3>

        {!editing && !extracted && (
          <div className="input-mode-tabs">
            <button type="button" className={`input-mode-tab${inputMode === 'image' ? ' input-mode-tab--active' : ''}`} onClick={() => switchMode('image')}>画像から</button>
            <button type="button" className={`input-mode-tab${inputMode === 'text' ? ' input-mode-tab--active' : ''}`} onClick={() => switchMode('text')}>テキストから</button>
            <button type="button" className={`input-mode-tab${inputMode === 'manual' ? ' input-mode-tab--active' : ''}`} onClick={() => switchMode('manual')}>手動入力</button>
          </div>
        )}

        {!editing && !extracted && inputMode === 'image' && (
          <div className="upload-form">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
            {preview && <img src={preview.dataUrl} alt="" className="upload-form__preview" />}
            {uploadError && <p className="error-msg">{uploadError}</p>}
            <button
              type="button"
              className="upload-form__extract-btn"
              onClick={handleExtract}
              disabled={!preview || extracting}
            >
              {extracting ? '解析中…' : '解析する'}
            </button>
          </div>
        )}

        {!editing && !extracted && inputMode === 'text' && (
          <div className="upload-form">
            <textarea
              className="upload-form__text-input"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={6}
              placeholder={'Instagramなどのキャプション文をここに貼り付け'}
            />
            {uploadError && <p className="error-msg">{uploadError}</p>}
            <button
              type="button"
              className="upload-form__extract-btn"
              onClick={handleExtractText}
              disabled={!pastedText.trim() || extracting}
            >
              {extracting ? '解析中…' : '解析する'}
            </button>
          </div>
        )}

        {!editing && !extracted && inputMode === 'manual' && (
          <CandidateForm mode="add" initialValues={{}} onSave={handleSaveNew} onCancel={() => switchMode('image')} />
        )}

        {extracted && !editing && (
          <CandidateForm mode="add" initialValues={extracted} onSave={handleSaveNew} onCancel={resetUpload} />
        )}

        {editing && (
          <CandidateForm mode="edit" initialValues={editing} onSave={handleSaveEdit} onCancel={() => setEditing(null)} />
        )}
      </section>

      <section className="candidates-section">
        <h3 className="section-title">登録済みの候補</h3>
        <input
          type="search"
          className="candidate-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="料理名で検索"
        />

        <CandidateListSection title="主菜" items={mains} onEdit={openEdit} onRemove={onRemoveCandidate} />
        <CandidateListSection title="副菜" items={sides} onEdit={openEdit} onRemove={onRemoveCandidate} />
      </section>
    </div>
  )
}
