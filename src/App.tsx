import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './components/AuthProvider.tsx'
import Header from './components/Header.tsx'
import OfflineBanner from './components/OfflineBanner.tsx'
import AdminPage from './pages/AdminPage.tsx'
import BookingPage from './pages/BookingPage.tsx'
import HomePage from './pages/HomePage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <OfflineBanner />
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/book" element={<BookingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
