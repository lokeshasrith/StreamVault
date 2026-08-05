import React, { Suspense, lazy } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const AppShell = lazy(() => import("./layout/AppShell"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const AnimeExplorePage = lazy(() => import("./pages/AnimeExplorePage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const ContentDetailsPage = lazy(() => import("./pages/ContentDetailsPage"));
const ApiStatusPage = lazy(() => import("./pages/ApiStatusPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070b] px-4 text-center text-[#F4EFE6]">
      <div>
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-[#FFC562]" />
        <p className="text-sm uppercase tracking-[0.22em] text-[#FFD48C]/70">Loading StreamVault</p>
      </div>
    </div>
  );
}

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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route 
          path="/auth" 
          element={
            token && userKey ? <Navigate to={appRoot} replace /> : <AuthPage />
          } 
        />
        
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
          <Route path="anime" element={<AnimeExplorePage />} />
          <Route path="library/:status" element={<LibraryPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="status" element={<ApiStatusPage />} />
        </Route>
        <Route path="/app" element={<Navigate to={appRoot} replace />} />
        <Route path="/" element={<Navigate to={appRoot} replace />} />
        <Route path="*" element={<Navigate to={appRoot} replace />} />
      </Routes>
    </Suspense>
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
  return (
    <ErrorBoundary>
      {import.meta.env.PROD ? (
        <HashRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </HashRouter>
      ) : (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      )}
    </ErrorBoundary>
  );
}
