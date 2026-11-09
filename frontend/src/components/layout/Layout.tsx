import clsx from 'clsx';
import { Bell, CalendarCheck, CalendarDays, CalendarOff, FolderArchive, FolderKanban, LayoutDashboard, ListChecks, LogOut, UserRound, Users, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useRealtime } from '../../hooks/useRealtime';
import { ROLE_LABEL } from '../../lib/constants';
import { NotificationBell } from '../notifications/NotificationBell';
import { Avatar } from '../ui/Avatar';
import { ThemeToggle } from '../ui/ThemeToggle';
import { BrandMark } from '../ui/Brand';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/my-work', label: 'Hôm nay', icon: CalendarCheck, end: false },
  { to: '/projects', label: 'Dự án', icon: FolderKanban, end: false },
  { to: '/tasks', label: 'Công việc', icon: ListChecks, end: false },
  { to: '/files', label: 'Kho tài liệu', icon: FolderArchive, end: false },
  { to: '/calendar', label: 'Lịch', icon: CalendarDays, end: false },
  { to: '/leave', label: 'Nghỉ phép', icon: CalendarOff, end: false },
  { to: '/teams', label: 'Nhóm', icon: UsersRound, end: false },
  { to: '/members', label: 'Thành viên', icon: Users, end: false },
  { to: '/notifications', label: 'Thông báo', icon: Bell, end: false },
  { to: '/profile', label: 'Hồ sơ', icon: UserRound, end: false },
];

function Burger({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} aria-expanded={open} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] text-white transition hover:bg-white/5 lg:hidden">
      <span className={clsx('burger', open && 'open')} aria-hidden>
        <i />
        <i />
      </span>
    </button>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-10 flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }, index) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          style={{ animationDelay: `${0.15 + index * 0.07}s` }}
          className={({ isActive }) =>
            clsx(
              'flex animate-fade-up items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium uppercase tracking-[0.5px] transition-[background-color,color] duration-300',
              isActive ? 'bg-white text-black' : 'text-slate-600 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <Icon className="h-[17px] w-[17px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  useRealtime(user?.id);

  // Chuyển trang: về đầu trang và đóng menu mobile
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
    setDrawerOpen(false);
  }, [location.pathname]);

  // Esc đóng ngăn kéo; trả focus về nút đã mở nó
  useEffect(() => {
    if (!drawerOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.08] bg-sidebar px-3 py-6 lg:flex">
        <div className="px-3.5">
          <BrandMark className="text-xl" />
        </div>
        <NavList />
        <div className="mt-auto rounded-2xl border border-white/[0.08] p-3">
          {user && (
            <Link to="/profile" className="flex items-center gap-3 rounded-xl transition hover:opacity-80" aria-label="Hồ sơ của tôi">
              <Avatar name={user.name} avatarUrl={user.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-muted">{ROLE_LABEL[user.role]}</p>
              </div>
            </Link>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] px-3 py-2 text-xs text-slate-600 transition duration-300 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" /> <span className="link-underline">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Ngăn kéo mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-scrim-soft backdrop-blur-[6px] [animation:fade-in_0.3s_ease_both]" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col border-r border-white/[0.08] bg-sidebar px-3 py-6 shadow-[0_40px_100px_var(--shadow-deep)] [animation:drawer-in_0.45s_var(--ease-out)_both]">
            <div className="flex items-center justify-between px-3.5">
              <BrandMark className="text-xl" />
              <Burger open label="Đóng menu" onClick={() => setDrawerOpen(false)} />
            </div>
            <NavList onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-auto flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] uppercase tracking-[0.5px] text-slate-600 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </aside>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Thanh menu cố định: nền gradient + blur, thu gọn khi cuộn quá 50px */}
        <header
          className={clsx(
            'absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 backdrop-blur-[16px] transition-[padding,background] duration-500 sm:px-8',
            scrolled ? 'bg-bg/90 py-4' : 'bg-gradient-to-b from-bg/90 to-transparent py-6',
          )}
        >
          <button type="button" aria-label="Mở menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] text-white transition hover:bg-white/5 lg:hidden">
            <span className="burger" aria-hidden>
              <i />
              <i />
            </span>
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell />
            {user && (
              <Link to="/profile" className="flex items-center gap-2 transition hover:opacity-80" aria-label="Hồ sơ của tôi">
                <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                <span className="hidden text-[13px] font-medium text-slate-700 sm:inline">{user.name}</span>
              </Link>
            )}
          </div>
        </header>
        <main ref={mainRef} onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 50)} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-5 pb-16 pt-28 sm:px-8 md:px-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
