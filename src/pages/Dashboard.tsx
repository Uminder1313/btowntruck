import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  ScrollText,
  Star,
  Users,
  X,
} from 'lucide-react';
import { useAuth, isAdmin, isStaff } from '@/lib/auth';
import { Overview, Requests } from '@/components/dashboard/Requests';
import { ReviewsAdmin, NotesAdmin, FaqsAdmin } from '@/components/dashboard/Content';
import { UsersAdmin, AuditLog } from '@/components/dashboard/Admin';
import { SiteContentAdmin } from '@/components/dashboard/SiteContent';
import { Spinner, RolePill } from '@/components/dashboard/ui';
import { BUSINESS_NAME, content } from '@/data/site-content';

type SectionKey =
  | 'overview'
  | 'requests'
  | 'site'
  | 'reviews'
  | 'notes'
  | 'faqs'
  | 'users'
  | 'audit';

const SECTIONS: {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'requests', label: 'Service requests', icon: ClipboardList },
  { key: 'site', label: 'Site content', icon: PanelsTopLeft },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'notes', label: 'Road notes', icon: FileText },
  { key: 'faqs', label: 'FAQs', icon: HelpCircle },
  { key: 'users', label: 'Users', icon: Users, adminOnly: true },
  { key: 'audit', label: 'Audit log', icon: ScrollText, adminOnly: true },
];

/**
 * /dashboard — protected.
 *
 * Signed-out visitors are redirected to /admin/login (this is a staff
 * surface), customer accounts to /account, and staff accounts still waiting
 * for approval to /admin/pending. What the sidebar shows depends on the
 * role, but that is only presentation: the database enforces every read and
 * write through row-level security, and the admin-only edge function actions
 * re-check the caller's role from their JWT, so hiding a link is never the
 * thing keeping data safe.
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading, signOut } = useAuth();
  const [section, setSection] = useState<SectionKey>('overview');
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate('/admin/login', { replace: true });
  }, [loading, session, navigate]);

  /* Customers have no business on the dispatch board — send them home.
     Staff awaiting approval get the waiting screen instead. */
  useEffect(() => {
    if (loading || !session || !profile) return;
    if (profile.role === 'customer') navigate('/account', { replace: true });
    else if (profile.role === 'pending_staff') navigate('/admin/pending', { replace: true });
  }, [loading, session, profile, navigate]);

  /* A session whose profile is missing or deactivated gets signed straight
     out — the account exists but is not allowed to work here. */
  useEffect(() => {
    if (!loading && session && (!profile || !profile.is_active)) {
      toast.error('This account is not active. Contact an administrator.');
      signOut().then(() => navigate('/admin/login', { replace: true }));
    }
  }, [loading, session, profile, signOut, navigate]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-6">
        <Spinner label="Checking your session…" />
      </div>
    );
  }

  const visible = SECTIONS.filter((s) => !s.adminOnly || isAdmin(profile));

  const onSignOut = async () => {
    await signOut();
    toast.success('Signed out.');
    navigate('/admin/login', { replace: true });
  };

  const body = (() => {
    switch (section) {
      case 'requests':
        return <Requests />;
      case 'site':
        return <SiteContentAdmin />;
      case 'reviews':
        return <ReviewsAdmin />;
      case 'notes':
        return <NotesAdmin />;
      case 'faqs':
        return <FaqsAdmin />;
      case 'users':
        return <UsersAdmin />;
      case 'audit':
        return <AuditLog />;
      default:
        return <Overview />;
    }
  })();


  const NavList: React.FC<{ onPick?: () => void }> = ({ onPick }) => (
    <nav aria-label="Dashboard" className="space-y-1.5">
      {visible.map((s) => {
        const Icon = s.icon;
        const active = section === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setSection(s.key);
              onPick?.();
            }}
            aria-current={active ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14.5px] transition-colors duration-300 ${
              active
                ? 'border border-amber/40 bg-amber/12 font-semibold text-amber'
                : 'border border-transparent text-chalk/75 hover:border-white/10 hover:bg-white/[0.04] hover:text-chalk'
            }`}
          >
            <Icon size={16} className={active ? 'text-amber' : 'text-graphite'} />
            {s.label}
          </button>
        );
      })}
    </nav>
  );

  const Identity: React.FC = () => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="truncate text-[14px] font-semibold text-chalk">{profile.full_name ?? profile.email}</p>
      <p className="mono mt-1 truncate text-[9.5px] text-graphite">{profile.email}</p>
      <div className="mt-3">
        <RolePill role={profile.role} />
      </div>
      {!isStaff(profile) && (
        <p className="mono mt-3 text-[9px] leading-relaxed text-graphite">
          Viewer access — you can read the board but not change it.
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-ink">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.07] bg-ink/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link to="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#11161C" />
            <path
              d="M41 12a13 13 0 0 0-14.6 17.4L13.6 42.2a5.2 5.2 0 0 0 7.3 7.3l12.8-12.8A13 13 0 0 0 51 22l-7.4 7.4-6.2-1.8-1.8-6.2z"
              fill="#F4F5F7"
            />
            <circle cx="46" cy="48" r="6.5" fill="#FFB020" />
          </svg>
          <span className="font-display text-[14px] font-bold tracking-tight text-chalk">Dispatch</span>
        </Link>
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-chalk transition-colors hover:border-amber/50 hover:text-amber"
          aria-label={content.menuOpen}
        >
          <Menu size={17} />
        </button>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[268px] flex-none flex-col border-r border-white/[0.07] bg-[#0B0E12] px-5 py-6 lg:flex">
          <Link to="/" className="group flex items-center gap-3">
            <svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true">
              <rect width="64" height="64" rx="14" fill="#11161C" />
              <path
                d="M41 12a13 13 0 0 0-14.6 17.4L13.6 42.2a5.2 5.2 0 0 0 7.3 7.3l12.8-12.8A13 13 0 0 0 51 22l-7.4 7.4-6.2-1.8-1.8-6.2z"
                fill="#F4F5F7"
              />
              <circle cx="46" cy="48" r="6.5" fill="#FFB020" />
            </svg>
            <span className="leading-tight">
              <span className="block font-display text-[14.5px] font-bold tracking-tight text-chalk transition-colors group-hover:text-amber">
                Dispatch
              </span>
              <span className="mono block text-[9px] text-graphite">{BUSINESS_NAME}</span>
            </span>
          </Link>

          <div className="mt-8 flex-1">
            <NavList />
          </div>

          <div className="space-y-3">
            <Identity />
            <button type="button" onClick={onSignOut} className="btn-ghost w-full !py-2.5 text-[13.5px]">
              <LogOut size={14} />
              Sign out
            </button>
            <Link
              to="/"
              className="mono block text-center text-[9.5px] text-graphite transition-colors hover:text-amber"
            >
              View public site
            </Link>
          </div>
        </aside>

        {/* Mobile drawer */}
        <div className={`fixed inset-0 z-[70] lg:hidden ${navOpen ? '' : 'pointer-events-none'}`} aria-hidden={!navOpen}>
          <div
            className={`absolute inset-0 bg-ink/80 backdrop-blur-sm transition-opacity duration-300 ${
              navOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setNavOpen(false)}
          />
          <div
            className={`absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-white/10 bg-[#0B0E12] px-5 py-6 transition-transform duration-300 ${
              navOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard menu"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-[15px] font-bold tracking-tight text-chalk">Dispatch</span>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-chalk transition-colors hover:border-amber/50 hover:text-amber"
                aria-label={content.menuClose}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-7 flex-1">
              <NavList onPick={() => setNavOpen(false)} />
            </div>
            <div className="space-y-3">
              <Identity />
              <button type="button" onClick={onSignOut} className="btn-ghost w-full !py-2.5 text-[13.5px]">
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        </div>

        <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 sm:py-9 lg:px-10">{body}</main>
      </div>
    </div>
  );
};

export default Dashboard;
