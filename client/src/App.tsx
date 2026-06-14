import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DMView from './views/DMView.jsx'
import PlayerView from './views/PlayerView.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dm" element={<DMView />} />
        <Route path="/player" element={<PlayerView />} />
        <Route path="/" element={<Navigate to="/player" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
