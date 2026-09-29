import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/dashboard/ui';
import { useAuth, homeFor } from '@/components/auth/lib/auth';

/**
 * /admin (bare) — a doorway, not a page.
 *
 * Signed out it sends you to /admin/login; signed in it sends you wherever
 * your role belongs (dispatch board, waiting screen, or the customer area if
 * a customer somehow typed the URL).
 */
const AdminIndex: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate('/admin/login', { replace: true });
      return;
    }
    if (profile) navigate(homeFor(profile), { replace: true });
  }, [loading, session, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <Spinner label="Opening the staff area…" />
    </div>
  );
};

export default AdminIndex;
