import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitApplication } from '../api/applications';
import { PRIVACY_NOTICE_VERSION } from '../content/privacyNotice';
import Apply from './Apply';

vi.mock('../api/applications', () => ({ submitApplication: vi.fn() }));
const submit = vi.mocked(submitApplication);

// Created per test with `delay: null`: by default user-event waits a timer tick after every keystroke
// (about 15 ms each on Windows), which pushed these form tests past the 5 s limit when the suite ran in parallel.
let user: UserEvent;

const parentInput = () => screen.getByLabelText('Valideynin adı');
const phoneInput = () => screen.getByLabelText('Əlaqə nömrəsi');
const sendButton = () => screen.getByRole('button', { name: /Göndər/ });
const language = (name: string) => screen.getByRole('button', { name });
const consentBox = () => screen.getByRole('checkbox', { name: /razıyam/ });

async function fillValidForm() {
  await user.type(parentInput(), '  Aysel Məmmədova ');
  await user.type(phoneInput(), '+994 50 123 45 67');
  await user.type(screen.getByLabelText('Uşağın adı və soyadı'), 'Leyla Məmmədova');
  fireEvent.change(screen.getByLabelText('Doğum tarixi'), { target: { value: '2016-05-20' } });
  await user.click(consentBox());
}

describe('Apply form', () => {
  beforeEach(() => {
    window.location.hash = '';
    user = userEvent.setup({ delay: null });
    submit.mockReset();
    submit.mockResolvedValue();
  });

  it('lists the contact options next to the form', () => {
    render(<Apply />);
    expect(screen.getByRole('link', { name: /WhatsApp ilə yaz/ })).toHaveAttribute(
      'href',
      'https://wa.me/994509988707',
    );
    expect(screen.getByRole('link', { name: '+994 50 998 87 07' })).toHaveAttribute(
      'href',
      'tel:+994509988707',
    );
  });

  describe('validation', () => {
    it('reports every missing field, focuses the first one and sends nothing', async () => {
      render(<Apply />);
      await user.click(sendButton());

      expect(screen.getByText('Adınızı qeyd edin.')).toBeInTheDocument();
      expect(screen.getByText('Əlaqə nömrənizi qeyd edin.')).toBeInTheDocument();
      expect(screen.getByText('Uşağın adını və soyadını qeyd edin.')).toBeInTheDocument();
      expect(screen.getByText('Doğum tarixini seçin.')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Zəhmət olmasa qeyd olunan sahələri düzəldin.');
      expect(parentInput()).toHaveAttribute('aria-invalid', 'true');
      await vi.waitFor(() => expect(parentInput()).toHaveFocus());
      expect(submit).not.toHaveBeenCalled();
    });

    it.each([
      ['abc', 'Əlaqə nömrənizi qeyd edin'],
      ['12345', 'Nömrəni tam yazın'],
      ['1234567890123', 'Nömrəni tam yazın'],
      ['abc 123456789', 'Nömrəni tam yazın'],
    ])('rejects the phone number "%s"', async (phone, message) => {
      render(<Apply />);
      await user.type(phoneInput(), phone);
      await user.click(sendButton());
      expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    });

    it('moves focus to the phone, child name, birth date and language problems in that order', async () => {
      render(<Apply />);
      await user.type(parentInput(), 'Aysel');
      await user.click(sendButton());
      await vi.waitFor(() => expect(phoneInput()).toHaveFocus());

      await user.type(phoneInput(), '+994501234567');
      await user.click(sendButton());
      await vi.waitFor(() => expect(screen.getByLabelText('Uşağın adı və soyadı')).toHaveFocus());

      await user.type(screen.getByLabelText('Uşağın adı və soyadı'), 'Leyla');
      await user.click(sendButton());
      await vi.waitFor(() => expect(screen.getByLabelText('Doğum tarixi')).toHaveFocus());
    });

    it('limits input length to what the API accepts', () => {
      render(<Apply />);
      expect(parentInput()).toHaveAttribute('maxlength', '120');
      expect(phoneInput()).toHaveAttribute('maxlength', '32');
      expect(screen.getByLabelText('Uşağın adı və soyadı')).toHaveAttribute('maxlength', '120');
    });

    it('never lets the browser autofill the child’s details (SEC-F-06)', () => {
      render(<Apply />);
      expect(screen.getByLabelText('Uşağın adı və soyadı')).toHaveAttribute('autocomplete', 'off');
      expect(screen.getByLabelText('Doğum tarixi')).toHaveAttribute('autocomplete', 'off');
    });

    it('requires at least one training language', async () => {
      render(<Apply />);
      await fillValidForm();
      await user.click(language('Azərbaycan'));
      await user.click(sendButton());
      expect(screen.getByText('Ən azı bir təlim dili seçin.')).toBeInTheDocument();
      expect(submit).not.toHaveBeenCalled();

      await user.click(language('Rus'));
      expect(screen.queryByText('Ən azı bir təlim dili seçin.')).not.toBeInTheDocument();
    });

    it('clears a field error as soon as the field is corrected', async () => {
      render(<Apply />);
      await user.click(sendButton());
      await user.type(parentInput(), 'A');
      expect(screen.queryByText('Adınızı qeyd edin.')).not.toBeInTheDocument();
      await user.type(phoneInput(), '1');
      expect(screen.queryByText('Əlaqə nömrənizi qeyd edin.')).not.toBeInTheDocument();
      await user.type(screen.getByLabelText('Uşağın adı və soyadı'), 'L');
      expect(screen.queryByText('Uşağın adını və soyadını qeyd edin.')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Doğum tarixi'), { target: { value: '2016-05-20' } });
      expect(screen.queryByText('Doğum tarixini seçin.')).not.toBeInTheDocument();
    });
  });

  describe('consent and privacy notice (SEC-F-16)', () => {
    it('asks for the parent’s consent, focuses it and sends nothing when it is missing', async () => {
      render(<Apply />);
      await fillValidForm();
      await user.click(consentBox()); // take the yes back
      await user.click(sendButton());

      expect(screen.getByText('Davam etmək üçün razılığınızı təsdiq edin.')).toBeInTheDocument();
      expect(consentBox()).toHaveAttribute('aria-invalid', 'true');
      await vi.waitFor(() => expect(consentBox()).toHaveFocus());
      expect(submit).not.toHaveBeenCalled();
    });

    it('clears the consent error as soon as consent is given', async () => {
      render(<Apply />);
      await user.click(sendButton());
      expect(screen.getByText('Davam etmək üçün razılığınızı təsdiq edin.')).toBeInTheDocument();

      await user.click(consentBox());
      expect(screen.queryByText('Davam etmək üçün razılığınızı təsdiq edin.')).not.toBeInTheDocument();
      expect(consentBox()).toBeChecked();
    });

    it('starts unchecked: consent is never pre-ticked', () => {
      render(<Apply />);
      expect(consentBox()).not.toBeChecked();
    });

    it('sends the consent together with the version of the notice the parent saw', async () => {
      render(<Apply />);
      await fillValidForm();
      await user.click(sendButton());

      const payload = submit.mock.calls[0]?.[0];
      expect(payload).toMatchObject({ consent: true, privacy_notice_version: PRIVACY_NOTICE_VERSION });
    });

    it('offers the privacy notice right under the consent box', () => {
      render(<Apply />);
      const box = consentBox();
      const notice = screen.getByText('Məxfilik bildirişini oxu');
      expect(box.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('children', () => {
    it('shows the child age on the programme start date and warns outside 8–13', () => {
      render(<Apply />);
      const birth = screen.getByLabelText('Doğum tarixi');
      fireEvent.change(birth, { target: { value: '2016-05-20' } });
      expect(screen.getByText('Proqram başlayanda: 10 yaş')).toBeInTheDocument();

      fireEvent.change(birth, { target: { value: '2010-01-01' } });
      expect(screen.getByText(/16 yaş\. Proqram 8–13 yaş üçündür\./)).toBeInTheDocument();
    });

    it('computes age correctly around the birthday (programme starts 5 December 2026)', () => {
      render(<Apply />);
      const birth = screen.getByLabelText('Doğum tarixi');
      fireEvent.change(birth, { target: { value: '2018-12-05' } });
      expect(screen.getByText('Proqram başlayanda: 8 yaş')).toBeInTheDocument();
      fireEvent.change(birth, { target: { value: '2018-12-06' } });
      expect(screen.getByText(/Proqram başlayanda: 7 yaş/)).toBeInTheDocument();
      fireEvent.change(birth, { target: { value: '2018-11-30' } });
      expect(screen.getByText('Proqram başlayanda: 8 yaş')).toBeInTheDocument();
    });

    it('adds a second child (with the family discount note) and removes it again', async () => {
      render(<Apply />);
      expect(screen.queryByText(/Ailə endirimi/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /İkinci uşağı əlavə et/ }));
      expect(screen.getByRole('group', { name: '2-ci uşaq' })).toBeInTheDocument();
      expect(screen.getByText(/Ailə endirimi/)).toHaveTextContent('1 150 AZN');
      expect(screen.queryByRole('button', { name: /İkinci uşağı əlavə et/ })).not.toBeInTheDocument();
      const secondChild = within(screen.getByRole('group', { name: '2-ci uşaq' }));
      await vi.waitFor(() => expect(secondChild.getByLabelText('Uşağın adı və soyadı')).toHaveFocus());

      await user.click(screen.getByRole('button', { name: '2-ci uşağı sil' }));
      expect(screen.queryByRole('group', { name: '2-ci uşaq' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /İkinci uşağı əlavə et/ })).toBeInTheDocument();
    });

    it('keeps error messages aligned with the right child when one is removed', async () => {
      render(<Apply />);
      await user.click(screen.getByRole('button', { name: /İkinci uşağı əlavə et/ }));
      await user.click(sendButton());
      expect(screen.getAllByText('Uşağın adını və soyadını qeyd edin.')).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: '2-ci uşağı sil' }));
      expect(screen.getAllByText('Uşağın adını və soyadını qeyd edin.')).toHaveLength(1);
    });
  });

  describe('submission', () => {
    it('sends the trimmed details with languages in programme order, then confirms', async () => {
      render(<Apply />);
      await fillValidForm();
      await user.click(language('İngilis'));
      await user.click(language('Rus'));
      await user.click(sendButton());

      expect(submit).toHaveBeenCalledExactlyOnceWith({
        parent_name: 'Aysel Məmmədova',
        phone: '+994 50 123 45 67',
        children: [{ name: 'Leyla Məmmədova', birth_date: '2016-05-20' }],
        languages: ['Azərbaycan', 'Rus', 'İngilis'],
        consent: true,
        privacy_notice_version: PRIVACY_NOTICE_VERSION,
      });
      expect(await screen.findByText(/Müraciətiniz qəbul olundu/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Müraciət göndərildi/ })).toBeDisabled();
    });

    it('sends two children when two were entered', async () => {
      render(<Apply />);
      await fillValidForm();
      await user.click(screen.getByRole('button', { name: /İkinci uşağı əlavə et/ }));
      const secondChild = within(screen.getByRole('group', { name: '2-ci uşaq' }));
      await user.type(secondChild.getByLabelText('Uşağın adı və soyadı'), 'Tural');
      fireEvent.change(secondChild.getByLabelText('Doğum tarixi'), { target: { value: '2014-02-02' } });
      await user.click(sendButton());

      expect(submit.mock.calls[0][0].children).toEqual([
        { name: 'Leyla Məmmədova', birth_date: '2016-05-20' },
        { name: 'Tural', birth_date: '2014-02-02' },
      ]);
    });

    it('blocks a second submission while the first is still in flight', async () => {
      let finish: () => void = () => {};
      submit.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      render(<Apply />);
      await fillValidForm();
      await user.click(sendButton());

      expect(screen.getByRole('button', { name: /Göndərilir/ })).toBeDisabled();
      fireEvent.submit(screen.getByRole('form', { name: 'Müraciət forması' }));
      expect(submit).toHaveBeenCalledTimes(1);
      finish();
      expect(await screen.findByText(/Müraciətiniz qəbul olundu/)).toBeInTheDocument();
    });

    it('ignores further submits once the application was sent', async () => {
      render(<Apply />);
      await fillValidForm();
      await user.click(sendButton());
      await screen.findByText(/Müraciətiniz qəbul olundu/);
      fireEvent.submit(screen.getByRole('form', { name: 'Müraciət forması' }));
      expect(submit).toHaveBeenCalledTimes(1);
    });

    it('offers WhatsApp as a fallback when the API is unreachable, with a plain greeting only', async () => {
      submit.mockRejectedValue(new Error('network'));
      render(<Apply />);
      await fillValidForm();
      await user.click(sendButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('Müraciət göndərilmədi.');
      const link = screen.getByRole('link', { name: 'WhatsApp ilə bizə yaz' });
      const href = new URL(link.getAttribute('href') ?? '');
      expect(href.origin + href.pathname).toBe('https://wa.me/994509988707');
      expect(href.searchParams.get('text')).toBe('Salam! KidsUp proqramına müraciət etmək istəyirəm.');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('never puts parent or child details into any link, even after they were typed (SEC-F-06)', async () => {
      submit.mockRejectedValue(new Error('network'));
      const { container } = render(<Apply />);
      await fillValidForm();
      await user.click(sendButton());
      await screen.findByRole('alert');

      const links = Array.from(container.querySelectorAll('a[href]'), (anchor) =>
        decodeURIComponent(anchor.getAttribute('href') ?? ''),
      );
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        for (const detail of ['Aysel', 'Məmmədova', 'Leyla', '501234567', '50 123 45 67', '2016-05-20']) {
          expect(link, `a link contains "${detail}"`).not.toContain(detail);
        }
      }
    });

    it('lets the parent fix the form and retry after a failure', async () => {
      submit.mockRejectedValueOnce(new Error('network'));
      render(<Apply />);
      await fillValidForm();
      await user.click(sendButton());
      await screen.findByText('Müraciət göndərilmədi.');

      await user.type(parentInput(), 'x');
      expect(screen.queryByRole('link', { name: 'WhatsApp ilə bizə yaz' })).not.toBeInTheDocument();
      await user.click(sendButton());
      expect(await screen.findByText(/Müraciətiniz qəbul olundu/)).toBeInTheDocument();
      expect(submit).toHaveBeenCalledTimes(2);
    });
  });
});
