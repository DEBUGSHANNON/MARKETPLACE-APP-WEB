import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';
import {
  ChevronDown,
  Heart,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { AppView } from '../types/marketplace';
import { isUtmStudentEmail } from '../data/utmCatalog';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: User | null;
  onSignIn: () => void;
  onSwitchAccount: () => void;
  onSignOut: () => void;
  onOpenCreateModal: () => void;
  reservationCount: number;
  wishlistCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  user,
  onSignIn,
  onSwitchAccount,
  onSignOut,
  onOpenCreateModal,
  reservationCount,
  wishlistCount,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const displayName =
    user?.displayName?.trim() || user?.email?.split('@')[0] || 'Student';
  const utmVerified = isUtmStudentEmail(user?.email);

  const navItems: { id: AppView; label: string }[] = [
    { id: 'orbit', label: 'Home' },
    { id: 'catalog', label: 'Catalog' },
    {
      id: 'reservations',
      label: reservationCount > 0 ? `Reservations (${reservationCount})` : 'Reservations',
    },
    {
      id: 'wishlist',
      label: wishlistCount > 0 ? `Wishlist (${wishlistCount})` : 'Wishlist',
    },
    { id: 'messages', label: 'My Messages' },
  ];

  return (
    <header className="fixed top-2.5 sm:top-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.25rem)] md:w-auto max-w-[95vw] h-12 sm:h-14 bg-white/75 md:bg-white/60 hover:bg-white/85 backdrop-blur-xl border border-white/65 shadow-[0_10px_32px_rgba(10,34,20,0.08)] rounded-2xl px-3.5 sm:px-5 flex items-center justify-between gap-3 sm:gap-7 transition-colors">
      {/* Zone 1: Brand wordmark */}
      <button
        type="button"
        onClick={() => onNavigate('orbit')}
        className="text-base sm:text-lg font-extrabold tracking-tight text-[#0A462C] whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 min-h-[40px]"
      >
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0A462C] text-white text-xs font-bold">
          C
        </span>
        <span>CampusTrade</span>
      </button>

      {/* Zone 2: Clean single-line navigation links */}
      <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-5">
        {navItems.map((item) => {
          const isActive =
            currentView === item.id ||
            (currentView === 'detail' && item.id === 'catalog');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative py-1 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#0A462C]'
                  : 'text-[#4A5D50] hover:text-[#0A462C]'
              }`}
            >
              {item.label}
              {isActive && (
                <motion.span
                  layoutId="navbar-active-underline"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute left-0 right-0 -bottom-1 h-[2px] bg-[#0A462C] rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action / User dropdown */}
      <div className="relative flex items-center shrink-0" ref={menuRef}>
        {!user ? (
          <button
            type="button"
            onClick={onSignIn}
            title="Sign in with your @graduate.utm.my UTM student Google account"
            className="px-4 py-2 rounded-lg bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            UTM Sign In
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-black/10 bg-white/85 text-sm font-semibold text-[#112419] hover:border-[#0A462C]/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserIcon className="w-4 h-4 text-[#0A462C]" />
              <span className="max-w-[110px] truncate">{displayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#4A5D50]" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[50px] w-60 bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl shadow-xl p-1.5 z-50">
                <div className="px-3 py-2 border-b border-black/5 mb-1">
                  <p className="text-xs font-semibold text-[#112419] truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-[#659A73] font-medium truncate">
                    {utmVerified ? 'Verified UTM Student' : user.email}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('profile');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-[#112419] hover:bg-[#F3F3EE] rounded-xl transition-colors cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-[#0A462C]" />
                  <span>Personal Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('wishlist');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-[#112419] hover:bg-[#F3F3EE] rounded-xl transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4 text-[#0A462C]" />
                    <span>Wishlist</span>
                  </span>
                  {wishlistCount > 0 && (
                    <span className="font-mono-tabular text-xs font-semibold text-[#659A73]">
                      {wishlistCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('my-listings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-[#112419] hover:bg-[#F3F3EE] rounded-xl transition-colors cursor-pointer"
                >
                  <Package className="w-4 h-4 text-[#0A462C]" />
                  <span>My Listings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('messages');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-[#112419] hover:bg-[#F3F3EE] rounded-xl transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <MessageSquare className="w-4 h-4 text-[#0A462C]" />
                    <span>My Messages</span>
                  </span>
                  {reservationCount > 0 && (
                    <span className="font-mono-tabular text-xs font-semibold text-[#659A73]">
                      {reservationCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenCreateModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold text-[#0A462C] hover:bg-[#DCE8D5]/60 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>List New Object</span>
                </button>

                <div className="my-1 border-t border-black/5" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSwitchAccount();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-[#112419] hover:bg-[#F3F3EE] rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-[#0A462C]" />
                  <span>Switch Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};
