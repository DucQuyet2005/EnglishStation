/**
 * Header Component
 * Application header with branding and status indicator.
 */
import './Header.css';

export function Header() {
  return (
    <header className="header" id="app-header">
      <div className="header__inner">
        <div className="header__brand">
          <div className="header__logo">
            <span className="header__logo-icon">🎙️</span>
          </div>
          <div className="header__text">
            <h1 className="header__title">EnglishStation</h1>
            <p className="header__subtitle">AI-Powered Speaking Practice</p>
          </div>
        </div>
        <div className="header__badge">
          <span className="header__badge-dot"></span>
          <span className="header__badge-text">Whisper AI</span>
        </div>
      </div>
    </header>
  );
}
