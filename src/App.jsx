import { Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import MOGenerate from './pages/MOGenerate';
import MOPrint from './pages/MOPrint';
import { useAuth } from './context/AuthContext';

// Protected Route Component
const ProtectedRoute = ({ children, requiredType }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  // If type mismatch, redirect.
  // Generally, if user is not '製令開立' (and not admin), they shouldn't be here.
  if (requiredType && user.type !== requiredType && user.type !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/register" element={<SignUp />} />
      <Route
        path="/mo-generate"
        element={
          <ProtectedRoute requiredType="製令開立">
            <MOGenerate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mo-print"
        element={
          <ProtectedRoute requiredType="製令開立">
            <MOPrint />
          </ProtectedRoute>
        }
      />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
