import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn,
  Menu,
  Phone,
  X,
  LogOut,
  User,
  Bell,
  Truck,
  ClipboardList,
  FileText,
} from 'lucide-react';
import { useAuth, isInternal } from '@/components/auth/lib/auth';
import { Shell } from '@/components/site/primitives';
import { NAV, PHONE, PHONE_HREF, content, BUSINESS_NAME } from '@/data/site-content';

/** Wordmark: amber wrench-and-bolt mark plus the business name. */
const Wordmark: React.FC = () => (
  <a href="#top" className="group flex items-center gap-3" aria-label={`${BUSINESS_NAME} — home`}>
    <svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill="#0E1116" />
      <path
        d="M41 12a13 13 0 0 0-14.6 17.4L13.6 42.2a5.2 5.2 0 0 0 7.3 7.3l12.8-12.8A13 13 0 0 0 51 22l-7.4 7.4-6.2-1.8-1.8-6.2z"
        fill="#F4F5F7"
      />
      <circle cx="46" cy="48" r="6.5" fill="#FFB020" />
    </svg>
    <span className="leading-tight">
      <span className="block font-display text-[15px] font-bold tracking-tight text-chalk transition-colors duration-300 group-hover:text-amber">
        BTown
      </span>
      <span className="mono block text-[9.5px] text-graphite">{content.wordmarkSub}</span>
    </span>
  </a>
);

const Header: React.FC = () => {
  const { profile, loading, signOut } = useAuth();

const [scrolled, setScrolled] = useState(false);
const [open, setOpen] = useState(false);
const [userMenuOpen, setUserMenuOpen] = useState(false);
const userMenuCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
const notificationCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
const [notificationOpen, setNotificationOpen] = useState(false);
const [notifications, setNotifications] = useState<any[]>([]);
const notificationBaseline = React.useRef<Map<number, { created_at: string; updated_at?: string; status?: string }>>(new Map());
const notificationReady = React.useRef(false);

  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      notificationBaseline.current.clear();
      notificationReady.current = false;
      return;
    }

    const API_BASE = import.meta.env.VITE_API_BASE_URL;
    const internalUser = isInternal(profile);
    const endpoint = internalUser
      ? `${API_BASE}/api/admin/requests`
      : `${API_BASE}/api/my-requests`;

    let stopped = false;

    const formatTime = (value: string) => {
      const date = new Date(value);
      const diff = Math.max(0, Date.now() - date.getTime());
      const minutes = Math.floor(diff / 60000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} min ago`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hr ago`;

      const days = Math.floor(hours / 24);
      return `${days} day ago`;
    };

    const loadNotifications = async () => {
      try {
        const token = window.sessionStorage.getItem('btown_session_token') || '';

        if (!token || stopped) return;

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();

        const requests = internalUser
          ? (Array.isArray(data.rows) ? data.rows : [])
          : (Array.isArray(data.requests) ? data.requests : []);

        const nextBaseline = new Map<
          number,
          {
            created_at: string;
            updated_at?: string;
            status?: string;
          }
        >();

        requests.forEach((request: any) => {
          nextBaseline.set(request.id, {
            created_at: request.created_at,
            updated_at: request.updated_at,
            status: request.status,
          });
        });

        if (!notificationReady.current) {
          notificationBaseline.current = nextBaseline;
          notificationReady.current = true;
          return;
        }

        const generated = requests
          .filter((request: any) => {
            const previous = notificationBaseline.current.get(request.id);

            if (!previous) {
              return true;
            }

            if (internalUser) {
              return previous.updated_at !== request.updated_at;
            }

            return previous.status !== request.status;
          })
          .slice(0, 8)
          .map((request: any) => {
            const previous = notificationBaseline.current.get(request.id);
            const isNew = !previous;

            const notificationId = internalUser
              ? `request-${request.id}-${request.updated_at}`
              : `customer-request-${request.id}-${request.status}`;

            return {
              id: notificationId,
              title: isNew
                ? 'New service request'
                : internalUser
                  ? 'Request updated'
                  : 'Service request updated',
              message: isNew
                ? internalUser
                  ? `${request.name || 'A customer'} submitted a new service request.`
                  : 'Your service request has been submitted successfully.'
                : internalUser
                  ? `Request #${request.id} is now ${request.status || 'updated'}.`
                  : `Your service request is now ${request.status || 'updated'}.`,
              time: formatTime(
                request.updated_at || request.created_at
              ),
              type: 'request',
              unread: true,
            };
          });

        if (generated.length) {
          setNotifications((current) => {
            const existingIds = new Set(current.map((item) => item.id));

            return [
              ...generated.filter((item: any) => !existingIds.has(item.id)),
              ...current,
            ].slice(0, 20);
          });
        }

        notificationBaseline.current = nextBaseline;
      } catch (error) {
        console.error('Notification refresh error:', error);
      }
    };

    void loadNotifications();

    const timer = window.setInterval(
      () => void loadNotifications(),
      30000
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [profile]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-white/[0.07] bg-ink/85 backdrop-blur-xl'
            : 'border-b border-transparent'
        }`}
      >
        <Shell className="flex h-[72px] items-center justify-between gap-4">
          <div className="flex items-center lg:mr-12">
            <Wordmark />
          </div>

          <nav aria-label="Main" className="hidden items-center gap-5 lg:flex xl:gap-6">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="relative whitespace-nowrap text-[14.5px] font-medium text-chalk/75 transition-colors duration-300 hover:text-amber"
              >
                {item.label}
              </a>
            ))}
          </nav>

          
            {!loading && profile && (
              <div
                className="relative hidden sm:flex"
                onMouseEnter={() => { if (notificationCloseTimer.current) clearTimeout(notificationCloseTimer.current); setNotificationOpen(true); }}
                onMouseLeave={() => { notificationCloseTimer.current = setTimeout(() => setNotificationOpen(false), 180); }}
              >
                <button
                  type="button"
                  onClick={() => setNotificationOpen((v) => !v)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-chalk/80 transition-all duration-300 hover:border-amber/40 hover:text-amber"
                  aria-label="Notifications"
                  aria-expanded={notificationOpen}
                  aria-haspopup="menu"
                >
                  <Bell size={17} />

                  {notifications.some((item) => item.unread) && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-[#0E1116] bg-amber px-1 text-[9px] font-bold text-ink">
                      {notifications.filter((item) => item.unread).length}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div
                    className="absolute right-0 top-full z-[70] mt-1 w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#11151b] shadow-2xl"
                    role="menu"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                      <div>
                        <p className="text-[13px] font-semibold text-chalk">
                          Notifications
                        </p>
                        <p className="mt-0.5 text-[10px] text-chalk/40">
                          Stay updated with your activity
                        </p>
                      </div>

                      {notifications.some((item) => item.unread) && (
                        <button
                          type="button"
                          onClick={() =>
                            setNotifications((items) =>
                              items.map((item) => ({ ...item, unread: false }))
                            )
                          }
                          className="text-[10px] font-medium text-amber transition-colors hover:text-amber/80"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            setNotifications((items) =>
                              items.map((item) =>
                                item.id === notification.id
                                  ? { ...item, unread: false }
                                  : item
                              )
                            );
                            setNotificationOpen(false);
                          }}
                          className="flex w-full gap-3 border-b border-white/[0.05] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              notification.type === 'load'
                                ? 'bg-amber/10 text-amber'
                                : notification.type === 'request'
                                  ? 'bg-blue-400/10 text-blue-300'
                                  : notification.type === 'invoice'
                                    ? 'bg-emerald-400/10 text-emerald-300'
                                    : 'bg-white/[0.06] text-chalk/60'
                            }`}
                          >
                            {notification.type === 'load' ? (
                              <Truck size={15} />
                            ) : notification.type === 'request' ? (
                              <ClipboardList size={15} />
                            ) : notification.type === 'invoice' ? (
                              <FileText size={15} />
                            ) : (
                              <Bell size={15} />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[12px] font-semibold text-chalk">
                                {notification.title}
                              </span>

                              {notification.unread && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                              )}
                            </span>

                            <span className="mt-1 block text-[11px] leading-relaxed text-chalk/50">
                              {notification.message}
                            </span>

                            <span className="mt-1.5 block text-[10px] text-chalk/30">
                              {notification.time}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-white/[0.07] p-2">
                      <button
                        type="button"
                        onClick={() => setNotificationOpen(false)}
                        className="w-full rounded-xl px-3 py-2.5 text-center text-[11px] font-medium text-chalk/60 transition-colors hover:bg-white/[0.05] hover:text-amber"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          <div className="flex items-center gap-3 lg:ml-6">
{!loading && profile ? (
  <div
  className="relative hidden items-center gap-3 sm:flex"
  onMouseEnter={() => { if (userMenuCloseTimer.current) clearTimeout(userMenuCloseTimer.current); setUserMenuOpen(true); }}
  onMouseLeave={() => { userMenuCloseTimer.current = setTimeout(() => setUserMenuOpen(false), 180); }}
>
  <button
    type="button"
    onClick={() => setUserMenuOpen((v) => !v)}
    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 transition-colors hover:border-amber/40"
    aria-expanded={userMenuOpen}
    aria-haspopup="menu"
  >
    <User size={15} className="text-amber" />

    <span className="flex flex-col text-left leading-tight">
      <span className="text-[13px] font-semibold text-chalk">
        {profile.full_name || 'Account'}
      </span>

      <span className="text-[11px] text-chalk/50">
        {profile.email}
      </span>
    </span>
  </button>

  {userMenuOpen && (
    <div
      className="absolute right-0 top-full z-[70] mt-1 w-[220px] rounded-2xl border border-white/10 bg-[#11151b] p-2 shadow-2xl"
      role="menu"
    >
      <Link
        to={
          profile.role === 'admin' ||
          profile.role === 'dispatcher' ||
          profile.role === 'viewer'
            ? '/dashboard'
            : '/account'
        }
        onClick={() => setUserMenuOpen(false)}
        className="block rounded-xl px-4 py-3 text-[13px] text-chalk transition-colors hover:bg-white/[0.06] hover:text-amber"
        role="menuitem"
      >
        <span className="block font-semibold">
          {profile.role === 'admin' ||
          profile.role === 'dispatcher' ||
          profile.role === 'viewer'
            ? 'Dashboard'
            : 'My Account'}
        </span>

        <span className="mt-1 block text-[11px] text-chalk/50">
          Manage your account
        </span>
      </Link>

      <button
        type="button"
        onClick={() => {
          setUserMenuOpen(false);
          void signOut();
        }}
        className="mt-1 flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-[13px] text-chalk/75 transition-colors hover:bg-red-400/10 hover:text-red-300"
        role="menuitem"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </div>
  )}
</div>
) : !loading ? (
  <Link
    to="/login"
    className="btn-amber hidden whitespace-nowrap !px-5 !py-2.5 text-[14px] sm:inline-flex"
    onClick={() => {
      try {
        window.supercool?.track?.('cta_click', { cta: 'header-login' });
      } catch {
        /* analytics must never break the page */
      }
    }}
  >
    <LogIn size={15} />
    Login / Register
  </Link>
) : null}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-chalk transition-colors duration-300 hover:border-amber/50 hover:text-amber lg:hidden"
              aria-label={content.menuOpen}
            >
              <Menu size={18} />
            </button>
          </div>
        </Shell>
      </header>


      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-ink/80 backdrop-blur-sm transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute inset-y-0 right-0 flex w-full max-w-[380px] flex-col bg-[#11151b] px-6 pb-8 pt-6 shadow-2xl transition-transform duration-400 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between">
            <Wordmark />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-chalk transition-colors hover:border-amber/50 hover:text-amber"
              aria-label={content.menuClose}
            >
              <X size={18} />
            </button>
          </div>

          <nav aria-label="Mobile" className="mt-10 flex flex-col">
            {NAV.map((item, i) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setOpen(false)}
                className="font-display text-chalk/90 transition-colors duration-300 hover:text-amber"
                style={{
                  fontWeight: 800,
                  fontSize: 'clamp(28px, 7vw, 40px)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.28,
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0)' : 'translateY(14px)',
                  transition: `opacity .5s ease ${i * 55}ms, transform .5s cubic-bezier(.2,.8,.2,1) ${
                    i * 55
                  }ms, color .3s ease`,
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-auto space-y-3 pt-8">
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="btn-ghost w-full"
            >
              <LogIn size={16} />
              Login / Register
            </Link>

            <a
              href={PHONE_HREF}
              onClick={() => setOpen(false)}
              className="btn-amber pulse-glow w-full"
              aria-label={`${content.callCta}, 24/7`}
            >
              <Phone size={17} />
              <span className="mono text-[14px]">{PHONE}</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;









