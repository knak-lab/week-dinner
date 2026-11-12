// =============================================================
//  このアプリ用の設定（金庫・ログイン画面）
//  vault.js / googleAuth.js / AuthGate.jsx はお金ちゃんと共通の部品。アプリごとの違いはここだけに書く
// =============================================================

export const APP_ID = 'week-dinner'          // 金庫の名前（IndexedDB）と暗号鍵の区別に使う。変えると保存データが読めなくなる
export const DATA_LABEL = '献立や在庫のデータ'  // 指紋・顔認証の登録画面の説明に使う
export const ACCENT_COLOR = '#E8622C'

// 登録されたアカウントかをサーバー（GAS）で確かめる。通らなければ googleAuth がログイン画面に戻す
// （gasApi.js は googleAuth.js を読み込むので、循環しないよう呼ぶときに読み込む）
export const verifyAccess = () => import('../utils/gasApi').then((m) => m.gasApi.getStockIngredients())

// 以前のバージョンが平文で localStorage に置いていたキャッシュを、金庫（暗号化）へ移して消す
const LEGACY_CACHE_PREFIX = 'week-dinner:v1:'

export async function migrateLegacyStorage() {
  const { vaultSet } = await import('./vault')
  let keys = []
  try { keys = Object.keys(localStorage) } catch { return }
  for (const k of keys) {
    if (!k.startsWith(LEGACY_CACHE_PREFIX)) continue
    try {
      const v = JSON.parse(localStorage.getItem(k) || 'null')
      if (v != null) vaultSet('cache:' + k.slice(LEGACY_CACHE_PREFIX.length), v)
    } catch { /* 壊れていたら移さずに消す */ }
    try { localStorage.removeItem(k) } catch { /* noop */ }
  }
}
