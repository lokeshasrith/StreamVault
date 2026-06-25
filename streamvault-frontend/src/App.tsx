import React from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AuthPage from "./pages/AuthPage";
import AppShell from "./layout/AppShell";
import DiscoverPage from "./pages/DiscoverPage";
import LibraryPage from "./pages/LibraryPage";
import ContentDetailsPage from "./pages/ContentDetailsPage";
import ApiStatusPage from "./pages/ApiStatusPage";
import ActivityPage from "./pages/ActivityPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, userKey } = useAuth();

  if (token && !userKey) {
    return <Navigate to="/auth" replace />;
  }

  return token ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  const { token, userKey } = useAuth();
  const appRoot = userKey ? `/app/${userKey}` : "/auth";

  return (
    <Routes>
      <Route 
        path="/auth" 
        element={
          token && userKey ? <Navigate to={appRoot} replace /> : <AuthPage />
        } 
      />
      
      {/* Content Details - Full Screen */}
      <Route
        path="/content/:type/:id"
        element={
          <ProtectedRoute>
            <ContentDetailsPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/app/:userKey"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DiscoverPage />} />
        <Route path="library/:status" element={<LibraryPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="status" element={<ApiStatusPage />} />
      </Route>
      <Route path="/app" element={<Navigate to={appRoot} replace />} />
      <Route path="/" element={<Navigate to={appRoot} replace />} />
      <Route path="*" element={<Navigate to={appRoot} replace />} />
    </Routes>
  );
}

// Error boundary component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#1a1a1a', 
          color: 'white', 
          minHeight: '100vh' 
        }}>
          <h1>StreamVault Error</h1>
          <p>Something went wrong: {this.state.error?.toString()}</p>
          <button onClick={() => window.location.reload()}>Reload App</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;

  return (
    <ErrorBoundary>
      <Router basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
