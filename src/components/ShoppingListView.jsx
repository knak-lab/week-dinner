import { useState } from 'react'

export default function ShoppingListView({
  groups, checkedItems, loading, stock, stockLoading,
  onCheckItem, onAddStock, onQuantityChange, onQuantityCommit, onRemoveStock, onRegenerate,
}) {
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')

  const submitAdd = (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    onAddStock(name, newQty.trim())
    setNewName('')
    setNewQty('')
  }

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
        ) : groups.length === 0 || groups.every((g) => g.items.length === 0) ? (
          <p className="empty-msg">この週の買い物リストはまだありません。献立を作ると自動生成されます。</p>
        ) : (
          <div className="shopping-groups">
            {groups.filter((g) => g.items.length > 0).map((g) => (
              <div key={g.label} className="shopping-group">
                <h4 className="shopping-group__label">{g.label}</h4>
                <ul className="shopping-group__items">
                  {g.items.map((item) => {
                    const key = `${g.label}__${item.ingredient_name}`
                    const isChecked = checkedItems.has(key)
                    return (
                      <li key={key} className={isChecked ? 'shopping-item--checked' : ''}>
                        <label className="shopping-item__label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isChecked}
                            onChange={() => onCheckItem(g.label, item)}
                          />
                          <span className="shopping-item__name">{item.ingredient_name}</span>
                        </label>
                        <span className="shopping-item__amount">{item.amount}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
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
          <ul className="stock-list">
            {stock.map((item) => (
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
        )}
      </section>
    </div>
  )
}
