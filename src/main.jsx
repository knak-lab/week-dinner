import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './auth/AuthGate.jsx'
import UpdateNotice from './components/UpdateNotice.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
    <UpdateNotice />
  </React.StrictMode>,
)
