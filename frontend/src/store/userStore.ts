import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
    id: string;          // Google's user_id (sub)
    email?: string;
    name?: string;
    picture?: string;
}

interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    setUser: (user: User | null) => void;
    login: (credential: string) => Promise<boolean>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,

            setUser: (user) => set({
                user,
                isAuthenticated: !!user
            }),

            login: async (credential: string) => {
                set({ isLoading: true });
                try {
                    const response = await fetch('/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ credential })
                    });

                    const data = await response.json();

                    if (data.success && data.user) {
                        set({
                            user: data.user,
                            isAuthenticated: true,
                            isLoading: false
                        });
                        return true;
                    }

                    set({ isLoading: false });
                    return false;
                } catch (error) {
                    console.error('Login failed:', error);
                    set({ isLoading: false });
                    return false;
                }
            },

            logout: () => {
                set({
                    user: null,
                    isAuthenticated: false
                });
            },

            checkAuth: async () => {
                const { user } = get();
                if (!user?.id) return;

                try {
                    const response = await fetch(`/api/auth/user/${user.id}`);
                    const data = await response.json();

                    if (!data.success) {
                        // User no longer exists, logout
                        set({ user: null, isAuthenticated: false });
                    }
                } catch (error) {
                    console.error('Auth check failed:', error);
                }
            }
        }),
        {
            name: 'deepdiagram-user',
        }
    )
);
