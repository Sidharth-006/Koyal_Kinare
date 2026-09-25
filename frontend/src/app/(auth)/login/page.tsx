'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Eye, EyeOff, Coffee, Leaf } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';

// Vector Bird & Leaf Branch Emblem matching reference branding
function KoyalBirdEmblem({ className = "w-28 h-24 text-[#D8C29D]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Curved Branch */}
      <path
        d="M 12 68 Q 60 62 118 30 Q 128 25 136 22"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Leaves along the branch */}
      <path
        d="M 70 60 C 76 50 88 50 84 61 C 81 65 72 65 70 60 Z"
        fill="currentColor"
      />
      <path
        d="M 92 44 C 100 36 108 40 102 47 C 97 51 92 47 92 44 Z"
        fill="currentColor"
      />
      <path
        d="M 110 32 C 118 24 125 29 118 36 C 114 39 109 35 110 32 Z"
        fill="currentColor"
      />
      <path
        d="M 52 65 C 48 74 38 72 43 65 C 47 61 51 63 52 65 Z"
        fill="currentColor"
      />
      <path
        d="M 78 61 C 83 69 75 73 72 67 C 71 63 75 60 78 61 Z"
        fill="currentColor"
      />
      {/* Bird Body & Silhouette */}
      <path
        d="M 64 48 C 55 40 55 26 67 18 C 77 10 88 14 88 22 C 88 24 85 26 82 26 C 77 22 68 22 64 26 C 59 30 61 38 68 44 C 73 48 83 45 92 37 C 96 33 100 28 97 23 C 103 27 107 33 102 40 C 95 49 81 55 72 56 C 64 57 56 65 53 77 C 49 81 44 74 47 66 C 52 56 58 51 64 48 Z"
        fill="currentColor"
      />
      {/* Long Bird Tail */}
      <path
        d="M 54 56 C 47 64 37 76 29 88 C 34 83 42 74 51 64 Z"
        fill="currentColor"
      />
      {/* Bird Beak */}
      <path
        d="M 88 20 L 96 22 L 89 25 Z"
        fill="currentColor"
      />
      {/* Bird Eye */}
      <circle cx="80" cy="20" r="1.8" fill="#1C3026" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const newErrors: { email?: string; password?: string } = {};
    if (!email || !email.trim()) newErrors.email = 'Email address is required.';
    if (!password) newErrors.password = 'Password is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      await api.login({ email: email.trim(), password });
      showToast('Welcome back! Signed in successfully.', 'success');
      router.push('/dashboard');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Sign-in details are incorrect. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#122018] overflow-x-hidden flex font-sans select-none">
      
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-luminosity scale-105 transition-transform duration-10000"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=2000&q=85')`,
        }}
        aria-hidden="true"
      />
      
      <div className="absolute inset-0 bg-gradient-to-r from-[#0E1B14]/90 via-[#14261C]/80 to-[#0A140F]/95" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/30 to-black/70" aria-hidden="true" />

      <div className="relative z-10 w-full min-h-screen flex flex-col lg:flex-row items-center justify-between p-6 sm:p-10 lg:p-16 max-w-7xl mx-auto">
        
        <div className="w-full lg:w-1/2 flex flex-col justify-between py-6 lg:py-12 lg:pr-12 text-center lg:text-left min-h-[220px] lg:min-h-[580px]">
          
          <div className="flex flex-col items-center lg:items-start space-y-3">
            <KoyalBirdEmblem className="w-32 h-24 text-[#D8C29D] drop-shadow-md" />
            
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#EFE9DF] drop-shadow-sm">
              Koyal Kinare
            </h1>

            <div className="flex items-center gap-3 w-full justify-center lg:justify-start pt-1">
              <div className="h-[1px] w-8 sm:w-12 bg-[#D8C29D]/40" />
              <span className="text-xs sm:text-sm font-semibold tracking-[0.35em] text-[#D8C29D] uppercase">
                CAFE
              </span>
              <div className="h-[1px] w-8 sm:w-12 bg-[#D8C29D]/40" />
            </div>

            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-[#C2B29A] uppercase pt-4">
              GOOD FOOD &nbsp;•&nbsp; GREAT VIBES &nbsp;•&nbsp; TOGETHER
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-2.5 text-xs font-medium tracking-[0.18em] text-[#9E9280] uppercase pt-12">
            <Coffee className="w-4 h-4 text-[#D8C29D]" />
            <span>FRESH COFFEE &nbsp;/&nbsp; DELICIOUS FOOD &nbsp;/&nbsp; HAPPY PEOPLE</span>
          </div>

        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center lg:justify-end py-4 lg:py-8">
          
          <div className="w-full max-w-[440px] bg-[#F4EFE6] rounded-[28px] sm:rounded-[32px] p-8 sm:p-10 md:p-11 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-[#E5DEC3]/30 transition-all">
            
            <div className="text-center mb-7 sm:mb-8">
              <span className="text-[11px] font-bold tracking-[0.28em] text-[#787062] uppercase block">
                ADMIN PORTAL
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C3026] mt-1.5 tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-[#5E6860] mt-2 font-normal leading-relaxed">
                Sign in to manage your cafe, sales, and operations.
              </p>
            </div>

            {generalError && (
              <div 
                role="alert" 
                className="mb-5 p-3.5 rounded-xl bg-rose-900/10 border border-rose-800/20 text-rose-900 text-xs font-medium animate-slide-up flex items-center gap-2.5"
              >
                <span className="w-2 h-2 rounded-full bg-rose-700 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              
              <div className="space-y-1.5">
                <label 
                  htmlFor="admin-email" 
                  className="block text-xs font-semibold text-[#2C3830] tracking-wide"
                >
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4.5 h-4.5 text-[#6B756D] pointer-events-none" />
                  <input
                    id="admin-email"
                    type="email"
                    name="email"
                    placeholder="admin@koyalkinare.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3.5 bg-[#E8E2D5] border border-[#DDD5C7] rounded-xl text-[#1C3026] placeholder-[#8C857B] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1C3026]/40 focus:border-[#1C3026] focus:bg-[#FAF7F2] transition-all min-h-[48px]"
                  />
                </div>
                {errors.email && (
                  <span className="text-xs text-rose-700 font-medium pl-1 block">{errors.email}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <label 
                  htmlFor="admin-password" 
                  className="block text-xs font-semibold text-[#2C3830] tracking-wide"
                >
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4.5 h-4.5 text-[#6B756D] pointer-events-none" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="w-full pl-11 pr-12 py-3.5 bg-[#E8E2D5] border border-[#DDD5C7] rounded-xl text-[#1C3026] placeholder-[#8C857B] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1C3026]/40 focus:border-[#1C3026] focus:bg-[#FAF7F2] transition-all min-h-[48px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 p-1.5 text-[#6B756D] hover:text-[#1C3026] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1C3026] rounded-md min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4.5 h-4.5" />
                    ) : (
                      <Eye className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-xs text-rose-700 font-medium pl-1 block">{errors.password}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 py-3.5 px-6 bg-[#1C3026] hover:bg-[#14241C] active:bg-[#0B1510] text-[#F4EFE6] rounded-xl font-semibold text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-70 min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C3026]"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>

            </form>

            <div className="flex items-center justify-center gap-3 mt-7 mb-3" aria-hidden="true">
              <div className="h-[1px] w-12 bg-[#DDD5C7]" />
              <Leaf className="w-3.5 h-3.5 text-[#1C3026] fill-[#1C3026]/20" />
              <div className="h-[1px] w-12 bg-[#DDD5C7]" />
            </div>

            <div className="text-center space-y-0.5">
              <p className="text-[10px] font-bold tracking-[0.22em] text-[#787062] uppercase">
                KOYAL KINARE CAFE
              </p>
              <p className="text-[9px] font-semibold tracking-[0.16em] text-[#8C8578] uppercase">
                ADMIN ACCESS ONLY
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}







