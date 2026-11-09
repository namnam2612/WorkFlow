import clsx from 'clsx';
import { Bell, CheckSquare, FolderKanban, LayoutDashboard, ListChecks, LogOut, Menu, Users, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { ROLE_LABEL } from '../../lib/constants';
import { Avatar } from '../ui/Avatar';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Dự án', icon: FolderKanban, end: false },
  { to: '/tasks', label: 'Công việc', icon: ListChecks, end: false },
  { to: '/members', label: 'Thành viên', icon: Users, end: false },
  { to: '/notifications', label: 'Thông báo', icon: Bell, end: false },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <CheckSquare className="h-5 w-5" />
      </span>
      <span className="text-lg font-bold tracking-tight text-slate-900">TaskFlow</span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-6 flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
        <Brand />
        <NavList />
        <div className="mt-auto rounded-xl bg-slate-50 p-3">
          {user && (
            <div className="flex items-center gap-3">
              <Avatar name={user.name} avatarUrl={user.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white hover:text-red-600"
          >
            <LogOut className="h-4 w-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Drawer mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-white px-3 py-5 shadow-xl">
            <button type="button" aria-label="Đóng menu" onClick={() => setDrawerOpen(false)} className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
            <Brand />
            <NavList onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <button type="button" aria-label="Mở menu" onClick={() => setDrawerOpen(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div id="header-actions" className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user.name}</span>
              </div>
            )}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
