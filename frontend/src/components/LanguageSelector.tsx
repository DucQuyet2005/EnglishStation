import './LanguageSelector.css';

interface LanguageSelectorProps {
  value: string;
  onChange: (lang: string) => void;
  disabled?: boolean;
}

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  return (
    <div className="language-selector">
      <label htmlFor="targetLang" className="language-selector__label">
        Bilingual Translation:
      </label>
      <div className="language-selector__select-wrapper">
        <select
          id="targetLang"
          className="language-selector__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="none">No translation (Original only)</option>
          <option value="vi">🇻🇳 Vietnamese</option>
          <option value="es">🇪🇸 Spanish</option>
          <option value="fr">🇫🇷 French</option>
          <option value="de">🇩🇪 German</option>
          <option value="zh-CN">🇨🇳 Chinese (Simplified)</option>
          <option value="ja">🇯🇵 Japanese</option>
          <option value="ko">🇰🇷 Korean</option>
        </select>
        <div className="language-selector__arrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </div>
  );
}
