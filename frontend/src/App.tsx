import { AuthProvider } from './contexts/AuthContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AppRoutes } from './router';

export default function App() {
   return (
      <AuthProvider>
         <Header />
         <main className="app-main">
            <AppRoutes />
         </main>
         <Footer />
      </AuthProvider>
   );
}
