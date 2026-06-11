import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useState,
   type ReactNode,
} from 'react';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth';
import { usersApi } from '../api/users';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import type { User } from '../types/api';
import { tokenStorage } from '../utils/storage';

interface AuthContextValue {
   user: User | null;
   isAuthenticated: boolean;
   isInitializing: boolean;
   login(payload: LoginPayload): Promise<void>;
   register(payload: RegisterPayload): Promise<void>;
   logout(): void;
   refresh(): Promise<void>;
   applyUser(user: User): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
   children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
   const [user, setUser] = useState<User | null>(null);
   const [isInitializing, setInitializing] = useState(true);

   const refresh = useCallback(async () => {
      if (!tokenStorage.get()) {
         setUser(null);
         return;
      }
      try {
         const fetched = await usersApi.me();
         setUser(fetched);
      } catch (error) {
         if (error instanceof ApiError && error.status === 401) {
            tokenStorage.clear();
            setUser(null);
            return;
         }
         throw error;
      }
   }, []);

   useEffect(() => {
      let cancelled = false;
      void (async () => {
         try {
            await refresh();
         } finally {
            if (!cancelled) {
               setInitializing(false);
            }
         }
      })();
      return () => {
         cancelled = true;
      };
   }, [refresh]);

   const login = useCallback(async (payload: LoginPayload) => {
      const response = await authApi.login(payload);
      tokenStorage.set(response.access_token);
      setUser(response.user);
   }, []);

   const register = useCallback(async (payload: RegisterPayload) => {
      const response = await authApi.register(payload);
      tokenStorage.set(response.access_token);
      setUser(response.user);
   }, []);

   const logout = useCallback(() => {
      tokenStorage.clear();
      setUser(null);
   }, []);

   // Hook global: qualquer chamada autenticada que receba 401 dispara
   // logout. Cobre o caso de token expirado em endpoints novos (ex.:
   // /assessment/project/next) sem precisar de try/catch caso a caso.
   useEffect(() => {
      setUnauthorizedHandler(() => {
         tokenStorage.clear();
         setUser(null);
      });
      return () => setUnauthorizedHandler(null);
   }, []);

   const applyUser = useCallback((updated: User) => {
      setUser(updated);
   }, []);

   const value = useMemo<AuthContextValue>(
      () => ({
         user,
         isAuthenticated: user !== null,
         isInitializing,
         login,
         register,
         logout,
         refresh,
         applyUser,
      }),
      [user, isInitializing, login, register, logout, refresh, applyUser],
   );

   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
   const context = useContext(AuthContext);
   if (!context) {
      throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
   }
   return context;
}
