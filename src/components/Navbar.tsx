import { Link, useLocation } from 'react-router-dom';
import { Trees, Home, PlusCircle, User, LogIn, LogOut, ChevronDown } from 'lucide-react';
import { useStore } from '@/store';
import { useState, useRef, useEffect } from 'react';
import type { User as UserType } from '@/types';
import { cn } from '@/lib/utils';

const roleLabels: Record<UserType['role'], { text: string; color: string }> = {
  citizen: { text: '市民', color: 'bg-sky-400 text-white' },
  organizer: { text: '组织者', color: 'bg-earth-500 text-white' },
  volunteer: { text: '志愿者', color: 'bg-forest-400 text-white' },
};

export default function Navbar() {
  const { currentUser, logout, switchRole, notifications } = useStore();
  const location = useLocation();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSwitchRole = async (role: UserType['role']) => {
    setSwitchingRole(true);
    try {
      await switchRole(role);
    } catch {
      // switchRole already shows notification on error
    }
    setSwitchingRole(false);
    setRoleMenuOpen(false);
  };

  const navLinks = [
    { to: '/', label: '活动大厅', icon: Home },
    ...(currentUser?.role === 'organizer' ? [{ to: '/publish', label: '发布活动', icon: PlusCircle }] : []),
    { to: '/profile', label: '个人中心', icon: User },
  ];

  return (
    <>
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {notifications.map((msg, i) => (
            <div
              key={i}
              className="animate-slide-up bg-forest-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
            >
              {msg}
            </div>
          ))}
        </div>
      )}

      <nav className="bg-forest-600 text-white shadow-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-serif text-xl font-bold tracking-wide">
            <Trees className="w-7 h-7" />
            <span>绿道活动</span>
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active ? 'bg-forest-800 text-white' : 'text-green-100 hover:bg-forest-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                    disabled={switchingRole}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleLabels[currentUser.role].color}`}>
                      {roleLabels[currentUser.role].text}
                    </span>
                    <span className="text-green-100 text-sm">{currentUser.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-green-200" />
                  </button>
                  {roleMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[120px] animate-fade-in">
                      {(['citizen', 'organizer', 'volunteer'] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => handleSwitchRole(role)}
                          disabled={switchingRole}
                          className={cn(
                            'w-full text-left px-4 py-2 text-sm hover:bg-green-50 transition-colors',
                            currentUser.role === role ? 'text-forest-600 font-medium' : 'text-gray-600',
                            switchingRole && 'opacity-50 cursor-wait'
                          )}
                        >
                          {roleLabels[role].text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-green-200 hover:text-white text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出
                </button>
              </>
            ) : (
              <button
                onClick={() => useStore.getState().login('13800138000', 'citizen')}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <LogIn className="w-4 h-4" />
                登录
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
