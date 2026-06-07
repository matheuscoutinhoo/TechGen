import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Spinner } from '../../ui/Spinner';
import { PageContainer } from '../PageContainer';

interface ProtectedRouteProps {
   children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
   const { isAuthenticated, isInitializing } = useAuth();
   const location = useLocation();

   if (isInitializing) {
      return (
         <PageContainer>
            <Spinner label="Carregando sua sessão..." />
         </PageContainer>
      );
   }

   if (!isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
   }

   return <>{children}</>;
}
