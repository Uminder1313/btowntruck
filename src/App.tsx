import { Toaster as Sonner } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { SiteContentProvider } from '@/lib/site-copy';
import Index from './pages/Index';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Account from './pages/Account';
import AdminIndex from './pages/AdminIndex';
import AdminLogin from './pages/AdminLogin';
import AdminRegister from './pages/AdminRegister';
import AdminPending from './pages/AdminPending';
import Forbidden from './pages/Forbidden';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

/**
 * Routing and providers only — all page UI lives in its own component.
 *
 * Public:     /  ·  /login  ·  /register  ·  /forgot-password  ·  /reset-password
 *             (customers; /admin/forgot-password is the staff reset door)
 * Staff:      /admin  ·  /admin/login  ·  /admin/register  ·  /admin/pending
 *             (not linked from anywhere on the public site)
 * Protected:  /dashboard  (admin/dispatcher/viewer; customers -> /account,
 *                          pending_staff -> /admin/pending)
 *             /account    (customers; staff -> /dashboard)
 *             /403 for a signed-in user whose role is too low
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SiteContentProvider>
        <TooltipProvider>
          {/* Amber-on-dark toast system: submissions, saves, publishes, errors */}
          <Sonner
            position="bottom-right"
            closeButton
            toastOptions={{
              style: {
                background: 'linear-gradient(180deg, rgba(28,35,44,0.97), rgba(17,21,27,0.98))',
                border: '1px solid rgba(255,176,32,0.35)',
                color: '#F4F5F7',
                borderRadius: '16px',
                fontFamily: 'Manrope, system-ui, sans-serif',
                fontSize: '14.5px',
                boxShadow:
                  'inset 0 1px rgba(255,255,255,0.12), 0 0 44px -10px rgba(255,176,32,0.35), 0 20px 44px -22px rgba(0,0,0,0.9)',
              },
              classNames: {
                title: 'font-semibold',
                description: 'text-[#8A93A0]',
                actionButton: 'bg-[#FFB020] text-[#0E1116]',
                closeButton: 'bg-[#11161C] border-white/15 text-[#8A93A0]',
              },
            }}
          />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<AdminIndex />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/forgot-password" element={<ForgotPassword variant="admin" />} />
              <Route path="/admin/register" element={<AdminRegister />} />
              <Route path="/admin/pending" element={<AdminPending />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/account" element={<Account />} />
              <Route path="/403" element={<Forbidden />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SiteContentProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
