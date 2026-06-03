/**
 * AuthPage — Login & Register with Google OAuth
 * Premium dark glassmorphism design matching the app's design system.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

type AuthMode = 'login' | 'register';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function AuthPage() {
  const { login, register, googleLogin } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Load Google Identity Services SDK
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => initGoogle();
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [mode]);

  function initGoogle() {
    if (!window.google || !GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
    });

    const btn = document.getElementById('google-btn-container');
    if (btn) {
      btn.innerHTML = '';
      window.google.accounts.id.renderButton(btn, {
        theme: 'filled_black',
        size: 'large',
        width: '100%',
        text: mode === 'login' ? 'signin_with' : 'signup_with',
        shape: 'rectangular',
      });
    }
  }

  async function handleGoogleCallback(response: { credential: string }) {
    setError('');
    setIsSubmitting(true);
    try {
      await googleLogin(response.credential);
    } catch (e: any) {
      setError(e.message || 'Google login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, fullName || undefined);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError('');
    setEmail('');
    setPassword('');
    setFullName('');
  }

  return (
    <div className="auth-page" id="auth-page">
      {/* Animated background orbs */}
      <div className="auth-page__bg">
        <div className="auth-page__orb auth-page__orb--1" />
        <div className="auth-page__orb auth-page__orb--2" />
        <div className="auth-page__orb auth-page__orb--3" />
      </div>

      <div className="auth-page__card" id="auth-card">
        {/* Logo & Brand */}
        <div className="auth-page__brand">
          <div className="auth-page__logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="url(#logo-grad)" />
              <path d="M8 12h16M8 16h10M8 20h13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="auth-page__brand-name">EnglishStation</h1>
          <p className="auth-page__brand-tagline">AI-Powered English Learning</p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="auth-page__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-page__tab ${mode === 'login' ? 'auth-page__tab--active' : ''}`}
            onClick={() => switchMode('login')}
            id="tab-login"
          >
            Sign In
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-page__tab ${mode === 'register' ? 'auth-page__tab--active' : ''}`}
            onClick={() => switchMode('register')}
            id="tab-register"
          >
            Create Account
          </button>
        </div>

        {/* Google Button */}
        <div className="auth-page__google-section">
          {GOOGLE_CLIENT_ID ? (
            <div id="google-btn-container" className="auth-page__google-btn-wrapper" />
          ) : (
            <button
              className="auth-page__google-btn"
              id="google-signin-btn"
              type="button"
              disabled
              title="Set VITE_GOOGLE_CLIENT_ID to enable Google login"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="auth-page__divider">
          <span className="auth-page__divider-text">or continue with email</span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="auth-page__error" role="alert" id="auth-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form className="auth-page__form" onSubmit={handleSubmit} noValidate id="auth-form">
          {mode === 'register' && (
            <div className="auth-page__field">
              <label className="auth-page__label" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                className="auth-page__input"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-page__field">
            <label className="auth-page__label" htmlFor="email">Email address</label>
            <input
              id="email"
              className="auth-page__input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label" htmlFor="password">
              Password
            </label>
            <div className="auth-page__input-wrapper">
              <input
                id="password"
                className="auth-page__input auth-page__input--pw"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-page__pw-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-page__submit"
            id="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="auth-page__spinner" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="auth-page__footer">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="auth-page__footer-link"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            id="auth-switch-mode"
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
