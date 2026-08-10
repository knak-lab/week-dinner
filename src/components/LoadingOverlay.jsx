import chefQuote from '../assets/chef-quote.webp'
import chefReveal from '../assets/chef-reveal.webp'

export default function LoadingOverlay({ phase }) {
  if (!phase) return null

  return (
    <div className="overlay">
      {phase === 'loading' && (
        <>
          <div className="overlay__runners" aria-hidden="true">
            <span className="overlay__emoji overlay__emoji--1">🔪</span>
            <span className="overlay__emoji overlay__emoji--2">🍴</span>
            <span className="overlay__emoji overlay__emoji--3">🥄</span>
            <span className="overlay__emoji overlay__emoji--4">👨‍🍳</span>
          </div>
          <p className="overlay__text">読み込み中、、、</p>
        </>
      )}

      {phase === 'generating' && (
        <div className="overlay__chef">
          <img src={chefQuote} alt="" className="overlay__chef-img" />
          <p className="overlay__quote">私の記憶が確かならば、、、</p>
        </div>
      )}

      {phase === 'reveal' && (
        <div className="overlay__chef">
          <img src={chefReveal} alt="" className="overlay__chef-img" />
        </div>
      )}
    </div>
  )
}
