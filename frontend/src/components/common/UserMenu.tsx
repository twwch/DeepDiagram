import { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useChatStore } from '../../store/chatStore';

// Google Client ID - should be configured in environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const UserMenu = () => {
    const { user, isAuthenticated, login, logout, isLoading } = useUserStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize Google Sign-In
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || isAuthenticated) return;

        const initGoogleSignIn = () => {
            if (typeof google === 'undefined' || !google.accounts) {
                // Retry after a short delay if Google SDK isn't loaded yet
                setTimeout(initGoogleSignIn, 100);
                return;
            }

            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCallback,
                auto_select: false,
                cancel_on_tap_outside: true,
            });
        };

        initGoogleSignIn();
    }, [isAuthenticated]);

    const handleGoogleCallback = async (response: google.accounts.id.CredentialResponse) => {
        if (response.credential) {
            const success = await login(response.credential);
            if (success) {
                // Reload sessions for the new user
                useChatStore.getState().loadSessions();
                // Clear current chat to start fresh
                useChatStore.getState().createNewChat();
            }
        }
    };

    const handleGoogleLogin = () => {
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Fallback: render the button if prompt doesn't show
                    const buttonDiv = document.getElementById('google-signin-button');
                    if (buttonDiv) {
                        google.accounts.id.renderButton(buttonDiv, {
                            type: 'standard',
                            theme: 'outline',
                            size: 'medium',
                            text: 'signin_with',
                            shape: 'rectangular',
                        });
                        buttonDiv.querySelector('div')?.click();
                    }
                }
            });
        }
    };

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
        // Revoke Google session
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        // Reload sessions (will show anonymous sessions or empty)
        useChatStore.getState().loadSessions();
        // Clear current chat
        useChatStore.getState().createNewChat();
    };

    // Not authenticated - show login button
    if (!isAuthenticated) {
        return (
            <div className="relative">
                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading || !GOOGLE_CLIENT_ID}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium text-slate-700 shadow-sm disabled:opacity-50"
                    title={!GOOGLE_CLIENT_ID ? 'Google Client ID not configured' : 'Sign in with Google'}
                >
                    {isLoading ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    )}
                    <span>Sign in</span>
                </button>
                {/* Hidden Google button for fallback */}
                <div id="google-signin-button" className="hidden" />
            </div>
        );
    }

    // Authenticated - show user avatar with dropdown
    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-100 transition-all"
            >
                {user?.picture ? (
                    <img
                        src={user.picture}
                        alt={user.name || 'User'}
                        className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {user?.name?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4" />}
                    </div>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            {user?.picture ? (
                                <img
                                    src={user.picture}
                                    alt={user.name || 'User'}
                                    className="w-10 h-10 rounded-full"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                    {user?.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                    {user?.name || 'User'}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                    {user?.email || ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
