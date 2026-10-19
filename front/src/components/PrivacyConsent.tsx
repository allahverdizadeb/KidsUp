import { useEffect, useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import { CONSENT_LABEL, PRIVACY_NOTICE, PRIVACY_NOTICE_ANCHOR } from '../content/privacyNotice';
import FieldError from './FieldError';

const NOTICE_HASH = `#${PRIVACY_NOTICE_ANCHOR}`;
/** The id the form focuses when the consent is missing. */
export const CONSENT_BOX_ID = 'f-consent';
const CONSENT_ERROR_ID = `${CONSENT_BOX_ID}-err`;

type PrivacyConsentProps = {
  isChecked: boolean;
  /** The message shown under the box; empty when there is nothing to fix. */
  error: string;
  onChange: (isChecked: boolean) => void;
};

/** The consent box (never pre-ticked) and the privacy notice it refers to (SEC-F-16). */
export default function PrivacyConsent({ isChecked, error, onChange }: PrivacyConsentProps) {
  const [isNoticeOpen, setIsNoticeOpen] = useState(() => window.location.hash === NOTICE_HASH);
  const hasError = error !== '';

  // The footer links to the notice: open it whenever the page is brought to that address.
  useEffect(() => {
    const openWhenTargeted = () => {
      if (window.location.hash === NOTICE_HASH) setIsNoticeOpen(true);
    };
    window.addEventListener('hashchange', openWhenTargeted);
    return () => window.removeEventListener('hashchange', openWhenTargeted);
  }, []);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    setIsNoticeOpen(isOpen);
    // While the address still ends in #mexfilik, following the footer link again would not change it, so nothing
    // would open. Closing the notice therefore clears the address.
    if (!isOpen && window.location.hash === NOTICE_HASH) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const handleCheckedChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <input
          id={CONSENT_BOX_ID}
          type="checkbox"
          checked={isChecked}
          onChange={handleCheckedChange}
          aria-invalid={hasError}
          aria-describedby={hasError ? CONSENT_ERROR_ID : undefined}
          style={{
            flexShrink: '0',
            width: '24px',
            height: '24px',
            margin: '1px 0 0',
            accentColor: '#FF0083',
            cursor: 'pointer',
          }}
        />
        <label
          htmlFor={CONSENT_BOX_ID}
          style={{ fontWeight: '600', fontSize: '15px', lineHeight: '1.5', cursor: 'pointer' }}
        >
          {CONSENT_LABEL}
        </label>
      </div>
      {hasError && <FieldError id={CONSENT_ERROR_ID} message={error} />}
      <details
        id={PRIVACY_NOTICE_ANCHOR}
        open={isNoticeOpen}
        onToggle={handleToggle}
        style={{ fontSize: '15px' }}
      >
        <summary
          style={{
            padding: '10px 0',
            fontWeight: '700',
            color: '#4A4A4A',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            cursor: 'pointer',
          }}
        >
          Məxfilik bildirişini oxu
        </summary>
        <dl
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            margin: '0',
            padding: '14px 16px',
            borderRadius: '6px',
            background: '#F6F6F6',
          }}
        >
          {PRIVACY_NOTICE.map(({ heading, text }) => (
            <div key={heading}>
              <dt style={{ fontWeight: '700', color: '#1A1A1A' }}>{heading}</dt>
              <dd style={{ margin: '0', lineHeight: '1.6', color: '#4A4A4A' }}>{text}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
