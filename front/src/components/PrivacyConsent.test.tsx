import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_LABEL, PRIVACY_NOTICE } from '../content/privacyNotice';
import PrivacyConsent from './PrivacyConsent';

const consentBox = () => screen.getByRole('checkbox', { name: CONSENT_LABEL });
const summary = () => screen.getByText('Məxfilik bildirişini oxu');
const notice = () => summary().closest('details') as HTMLDetailsElement;

function renderConsent(props: Partial<ComponentProps<typeof PrivacyConsent>> = {}) {
  const onChange = vi.fn();
  const { rerender } = render(<PrivacyConsent isChecked={false} error="" onChange={onChange} {...props} />);
  return { onChange, rerender, user: userEvent.setup({ delay: null }) };
}

describe('PrivacyConsent (SEC-F-16)', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  describe('the box', () => {
    it('shows what the parent agrees to and is not ticked by default', () => {
      renderConsent();
      expect(consentBox()).not.toBeChecked();
    });

    it('reports the new state when the parent ticks or unticks it', async () => {
      const { onChange, rerender, user } = renderConsent();
      await user.click(consentBox());
      expect(onChange).toHaveBeenLastCalledWith(true);

      // The owner of the state takes the yes; the box shows what it is given.
      rerender(<PrivacyConsent isChecked error="" onChange={onChange} />);
      await user.click(consentBox());
      expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it('shows the state it is given', () => {
      renderConsent({ isChecked: true });
      expect(consentBox()).toBeChecked();
    });

    it('can be ticked by clicking its text', async () => {
      const { onChange, user } = renderConsent();
      await user.click(screen.getByText(CONSENT_LABEL));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('the error', () => {
    it('is announced as the description of the box, which is marked invalid', () => {
      renderConsent({ error: 'Davam etmək üçün razılığınızı təsdiq edin.' });
      expect(consentBox()).toHaveAttribute('aria-invalid', 'true');
      expect(consentBox()).toHaveAccessibleDescription('Davam etmək üçün razılığınızı təsdiq edin.');
    });

    it('is absent, and so is the reference to it, when there is nothing to fix', () => {
      renderConsent();
      expect(consentBox()).toHaveAttribute('aria-invalid', 'false');
      expect(consentBox()).not.toHaveAttribute('aria-describedby');
      expect(document.getElementById('f-consent-err')).toBeNull();
    });
  });

  describe('the notice', () => {
    it('stays closed until asked, and then shows every section', async () => {
      const { user } = renderConsent();
      expect(notice()).not.toHaveAttribute('open');

      await user.click(summary());

      expect(notice()).toHaveAttribute('open');
      for (const { heading, text } of PRIVACY_NOTICE) {
        expect(screen.getByText(heading)).toBeVisible();
        expect(notice()).toHaveTextContent(text);
      }
    });

    it('lists each section as a term with its description', async () => {
      const { user } = renderConsent();
      await user.click(summary());

      const terms = within(notice()).getAllByRole('term');
      const definitions = within(notice()).getAllByRole('definition');
      expect(terms.map((term) => term.textContent)).toEqual(PRIVACY_NOTICE.map(({ heading }) => heading));
      expect(definitions.map((definition) => definition.textContent)).toEqual(
        PRIVACY_NOTICE.map(({ text }) => text),
      );
    });

    it('is set in text no smaller than the 15px of the rest of the form copy', () => {
      renderConsent();
      expect(notice()).toHaveStyle({ fontSize: '15px' });
    });

    it('opens when the page is opened at its link', () => {
      window.location.hash = '#mexfilik';
      renderConsent();
      expect(notice()).toHaveAttribute('open');
    });

    it('opens when its link is followed later', async () => {
      renderConsent();
      expect(notice()).not.toHaveAttribute('open');

      window.location.hash = '#mexfilik';

      await vi.waitFor(() => expect(notice()).toHaveAttribute('open'));
    });

    it('opens again when its link is followed a second time after it was closed', async () => {
      const { user } = renderConsent();
      window.location.hash = '#mexfilik';
      await vi.waitFor(() => expect(notice()).toHaveAttribute('open'));

      await user.click(summary()); // close it
      expect(notice()).not.toHaveAttribute('open');
      // The address would still end in #mexfilik: following the link again would then change nothing.
      expect(window.location.hash).toBe('');

      window.location.hash = '#mexfilik';
      await vi.waitFor(() => expect(notice()).toHaveAttribute('open'));
    });

    it('leaves any other address alone when it is closed', async () => {
      window.location.hash = '#muraciet';
      const { user } = renderConsent();
      await user.click(summary());
      await user.click(summary());

      expect(window.location.hash).toBe('#muraciet');
    });

    it('does not react to other addresses', async () => {
      renderConsent();
      window.location.hash = '#proqram';
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(notice()).not.toHaveAttribute('open');
    });

    it('stops listening for the link when it is removed from the page', () => {
      const removed = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(<PrivacyConsent isChecked={false} error="" onChange={() => {}} />);
      unmount();
      expect(removed).toHaveBeenCalledWith('hashchange', expect.any(Function));
      removed.mockRestore();
    });
  });
});
