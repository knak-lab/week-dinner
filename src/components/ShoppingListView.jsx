export default function ShoppingListView({ groups, loading }) {
  if (loading) return <p className="empty-msg">読み込み中…</p>
  if (groups.length === 0 || groups.every((g) => g.items.length === 0)) {
    return <p className="empty-msg">この週の買い物リストはまだありません。献立を作ると自動生成されます。</p>
  }

  return (
    <div className="shopping-groups">
      {groups.filter((g) => g.items.length > 0).map((g) => (
        <div key={g.label} className="shopping-group">
          <h3 className="shopping-group__label">{g.label}</h3>
          <ul className="shopping-group__items">
            {g.items.map((item) => (
              <li key={item.ingredient_name}>
                <span className="shopping-item__name">{item.ingredient_name}</span>
                <span className="shopping-item__amount">{item.amounts.join(' + ')}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
