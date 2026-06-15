import { create } from 'zustand';
import type { User } from './types';
import { users } from './api';

interface AppState {
  currentUser: User | null;
  notifications: string[];
  login: (phone: string, role: User['role']) => Promise<void>;
  logout: () => void;
  switchRole: (role: User['role']) => Promise<void>;
  addNotification: (msg: string) => void;
  clearNotifications: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  notifications: [],

  login: async (phone: string, role: User['role']) => {
    const user = await users.login(phone, role);
    set({ currentUser: user });
    get().addNotification(`欢迎回来，${user.name}！`);
  },

  logout: () => {
    set({ currentUser: null });
    get().addNotification('已退出登录');
  },

  switchRole: async (role: User['role']) => {
    const current = get().currentUser;
    if (!current) return;
    const user = await users.login(current.phone, role);
    set({ currentUser: user });
    const roleNames: Record<User['role'], string> = {
      citizen: '市民',
      organizer: '组织者',
      volunteer: '志愿者',
    };
    get().addNotification(`已切换为${roleNames[role]}角色`);
  },

  addNotification: (msg: string) => {
    set((s) => ({ notifications: [...s.notifications, msg] }));
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.slice(1) }));
    }, 3000);
  },

  clearNotifications: () => set({ notifications: [] }),
}));
