import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Dashboard from './pages/Dashboard';
import PresaDetail from './pages/PresaDetail';
import Login from './pages/Login';
import AdminLogs from './pages/AdminLogs';
import RequireAuth from './components/RequireAuth';


function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prese/:presaId" element={<PresaDetail />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin/logs"
              element={
                <RequireAuth>
                  <AdminLogs />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;