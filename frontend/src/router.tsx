import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { PageContainer } from './components/layout/PageContainer';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { CreateTrailPage } from './pages/CreateTrail';
import { TrailDetailPage } from './pages/TrailDetail';
import { EditTrailPage } from './pages/EditTrail';
import { AccountPage } from './pages/Account';
import { ConceptExplanationPage } from './pages/ConceptExplanation';
import { NotFoundPage } from './pages/NotFound';

export function AppRoutes() {
   const { isAuthenticated } = useAuth();

   return (
      <Routes>
         <Route
            path="/"
            element={
               isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
               ) : (
                  <PageContainer width="wide">
                     <HomePage />
                  </PageContainer>
               )
            }
         />
         <Route
            path="/login"
            element={
               isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
               ) : (
                  <PageContainer width="narrow">
                     <LoginPage />
                  </PageContainer>
               )
            }
         />
         <Route
            path="/register"
            element={
               isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
               ) : (
                  <PageContainer width="narrow">
                     <RegisterPage />
                  </PageContainer>
               )
            }
         />

         <Route
            path="/dashboard"
            element={
               <ProtectedRoute>
                  <PageContainer width="wide">
                     <DashboardPage />
                  </PageContainer>
               </ProtectedRoute>
            }
         />
         <Route
            path="/trails/new"
            element={
               <ProtectedRoute>
                  <PageContainer width="base">
                     <CreateTrailPage />
                  </PageContainer>
               </ProtectedRoute>
            }
         />
         <Route
            path="/trails/:id"
            element={
               <ProtectedRoute>
                  <PageContainer width="base">
                     <TrailDetailPage />
                  </PageContainer>
               </ProtectedRoute>
            }
         />
         <Route
            path="/trails/:id/edit"
            element={
               <ProtectedRoute>
                  <PageContainer width="base">
                     <EditTrailPage />
                  </PageContainer>
               </ProtectedRoute>
            }
         />
         <Route
            path="/trails/:id/tickets/:code/concepts/:concept"
            element={
               <ProtectedRoute>
                  <PageContainer width="base">
                     <ConceptExplanationPage />
                  </PageContainer>
               </ProtectedRoute>
            }
         />
         <Route
            path="/account"
            element={
               <ProtectedRoute>
                  <PageContainer width="base">
                     <AccountPage />
                  </PageContainer>
               </ProtectedRoute>
            }
         />

         <Route
            path="*"
            element={
               <PageContainer width="base">
                  <NotFoundPage />
               </PageContainer>
            }
         />
      </Routes>
   );
}
