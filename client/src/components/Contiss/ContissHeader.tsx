import React, { useState } from 'react';
import { useRecoilState } from 'recoil';
import store from '~/store';

interface ContissHeaderProps {
  className?: string;
}

const ContissHeader: React.FC<ContissHeaderProps> = ({ className = '' }) => {
  const [showQuickSearchDropdown, setShowQuickSearchDropdown] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [lang, setLang] = useRecoilState(store.lang);
  const [searchTerm, setSearchTerm] = useState('');

  // Map current language to locale for display
  const getLocaleFromLang = (language: string): string => {
    if (language.startsWith('de')) return 'de-DE';
    if (language.startsWith('en')) return 'en-US';
    return 'de-DE';
  };

  const selectedLocale = getLocaleFromLang(lang);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open('https://intra-ai.de', '_blank');
  };

  const toggleLanguagePicker = () => {
    setLanguagePickerOpen(!languagePickerOpen);
  };

  const selectLocale = (locale: string) => {
    // Map locale to language code used by i18n
    const langMap: Record<string, string> = {
      'de-DE': 'de',
      'en-US': 'en',
    };

    const newLang = langMap[locale] || 'de';
    setLang(newLang);
    setLanguagePickerOpen(false);
  };

  const getFlagForLocale = (locale: string): string => {
    switch (locale) {
      case 'de-DE':
        return '🇩🇪';
      case 'en-US':
        return '🇺🇸';
      default:
        return '🏳️';
    }
  };

  return (
    <header className={`contiss-header ${className}`}>
      <div className="contiss-header-content">
        {/* Logo Section */}
        <div className="contiss-logo-section">
          <a
            href="https://contiss.de"
            className="contiss-logo-container"
            onClick={handleLogoClick}
            aria-label="Zurück"
            title="Zurück"
          >
            <img
              src="/assets/logo.svg"
              alt="Logo"
              className="contiss-logo"
            />
          </a>
        </div>
      </div>

      {/* Actions Section (right) */}
      <div className="contiss-actions-section">
        {/* Language Picker */}
        <div className="contiss-language-picker">
          <button
            type="button"
            className="contiss-language-button"
            onClick={toggleLanguagePicker}
            aria-label="Select language"
            title="Sprache wählen"
          >
            <span className="contiss-flag">{getFlagForLocale(selectedLocale)}</span>
          </button>
          {languagePickerOpen && (
            <div className="contiss-language-dropdown">
              <button
                type="button"
                className={`contiss-language-item ${selectedLocale === 'de-DE' ? 'selected' : ''}`}
                onClick={() => selectLocale('de-DE')}
                aria-label="Deutsch (Deutschland)"
                title="Deutsch (Deutschland)"
              >
                <span className="contiss-flag">{getFlagForLocale('de-DE')}</span>
              </button>
              <button
                type="button"
                className={`contiss-language-item ${selectedLocale === 'en-US' ? 'selected' : ''}`}
                onClick={() => selectLocale('en-US')}
                aria-label="English (United States)"
                title="English (United States)"
              >
                <span className="contiss-flag">{getFlagForLocale('en-US')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default ContissHeader;
