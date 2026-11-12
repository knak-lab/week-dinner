// 起動時の体感速度を上げるための端末キャッシュ。
// GAS Webアプリはリダイレクトを挟むぶん1リクエストが数秒かかることがあるため、
// 前回取得した内容を即座に描画し、裏で最新を取りに行く（stale-while-revalidate）。
// 中身は端末の金庫（指紋・顔認証で開く暗号化保存）に置く。金庫が開くまでアプリ本体は表示されないので同期で読める。
// キャッシュは無くても動く前提なので、失敗はすべて握りつぶす。
import { vaultGet, vaultSet } from '../auth/vault'

const PREFIX = 'cache:'

export function readCache(key) {
  try {
    return vaultGet(PREFIX + key)
  } catch {
    return null
  }
}

export function writeCache(key, value) {
  try {
    vaultSet(PREFIX + key, value)
  } catch {
    // 鍵がかかっている・容量超過など。キャッシュ無しで動作を続ける。
  }
}
