import { useState, useMemo } from 'react'

const STOCK_CATEGORY_ORDER = ['肉', '野菜', '調味料', 'その他']

export default function ShoppingListView({
  groups, checkedItems, loading, stock, stockLoading,
  onCheckItem, onAddStock, onQuantityChange, onQuantityCommit, onRemoveStock, onRegenerate,
}) {
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [closedGroups, setClosedGroups] = useState(() => new Set())
  const [closedCategories, setClosedCategories] = useState(() => new Set())

  const toggleGroup = (label) => {
    setClosedGroups((prev) => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  const toggleCategory = (key) => {
    setClosedCategories((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const submitAdd = (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    onAddStock(name, newQty.trim())
    setNewName('')
    setNewQty('')
  }

  const stockByCategory = useMemo(() => {
    return STOCK_CATEGORY_ORDER
      .map((category) => ({ category, items: stock.filter((item) => item.category === category) }))
      .filter((g) => g.items.length > 0)
  }, [stock])

  return (
    <div className="shopping-view">
      <section>
        <div className="shopping-list-header">
          <h3 className="section-title">買い物リスト</h3>
          <button className="regenerate-btn" onClick={onRegenerate} disabled={loading}>
            買い物リストを再作成
          </button>
        </div>
        {loading ? (
          <p className="empty-msg">読み込み中…</p>
        ) : groups.length === 0 || groups.every((g) => g.categories.every((c) => c.items.length === 0)) ? (
          <p className="empty-msg">この週の買い物リストはまだありません。献立を作ると自動生成されます。</p>
        ) : (
          <div className="shopping-groups">
            {groups.filter((g) => g.categories.some((c) => c.items.length > 0)).map((g) => {
              const groupOpen = !closedGroups.has(g.label)
              return (
                <div key={g.label} className="shopping-group">
                  <button
                    type="button"
                    className="shopping-group__header"
                    onClick={() => toggleGroup(g.label)}
                    aria-expanded={groupOpen}
                  >
                    <span className={`shopping-caret ${groupOpen ? 'shopping-caret--open' : ''}`}>▸</span>
                    <h4 className="shopping-group__label">{g.label}</h4>
                  </button>
                  {groupOpen && g.categories.map((c) => {
                    const catKey = `${g.label}__${c.category}`
                    const catOpen = !closedCategories.has(catKey)
                    return (
                      <div key={c.category} className="shopping-category">
                        <button
                          type="button"
                          className="shopping-category__header"
                          onClick={() => toggleCategory(catKey)}
                          aria-expanded={catOpen}
                        >
                          <span className={`shopping-caret ${catOpen ? 'shopping-caret--open' : ''}`}>▸</span>
                          <h5 className="shopping-category__label">{c.category}</h5>
                        </button>
                        {catOpen && (
                          <ul className="shopping-group__items">
                            {c.items.map((item) => {
                              const key = `${g.label}__${item.ingredient_name}`
                              const isChecked = checkedItems.has(key)
                              return (
                                <li key={key} className={isChecked ? 'shopping-item--checked' : ''}>
                                  <label className="shopping-item__label">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => onCheckItem(g.label, item)}
                                    />
                                    <span className="shopping-item__name">{item.ingredient_name}</span>
                                  </label>
                                  <span className="shopping-item__amount">{item.amount}</span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">手持ちの食材</h3>
        <form onSubmit={submitAdd} className="stock-form">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="食材名"
            className="stock-form__name"
          />
          <input
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            placeholder="数量（任意）"
            className="stock-form__qty"
          />
          <button type="submit">追加</button>
        </form>

        {stockLoading ? (
          <p className="empty-msg">読み込み中…</p>
        ) : stock.length === 0 ? (
          <p className="empty-msg">手持ちの食材はまだありません。</p>
        ) : (
          <div className="stock-groups">
            {stockByCategory.map((g) => (
              <div key={g.category} className="stock-category">
                <h5 className="shopping-category__label">{g.category}</h5>
                <ul className="stock-list">
                  {g.items.map((item) => (
                    <li key={item.id} className="stock-item">
                      <label className="stock-item__label">
                        <input type="checkbox" onChange={() => onRemoveStock(item.id)} />
                        <span className="stock-item__name">{item.name}</span>
                      </label>
                      <input
                        className="stock-item__qty"
                        value={item.quantity}
                        onChange={(e) => onQuantityChange(item.id, e.target.value)}
                        onBlur={(e) => onQuantityCommit(item.id, e.target.value)}
                        placeholder="数量"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
