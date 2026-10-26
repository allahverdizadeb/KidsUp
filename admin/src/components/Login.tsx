import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { describeSignIn } from '../lib/errors.ts';
import { inputStyle } from '../lib/styles.ts';
import { sx } from '../lib/sx.ts';
import type { SignedOutReason } from '../state/SessionContext.ts';
import { useSession } from '../state/useSession.ts';
import { Field } from './ui/Field.tsx';

const WORDS: Record<SignedOutReason, { title: string; sub: string }> = {
  none: {
    title: 'Daxil ol',
    sub: 'Admin panelə daxil olmaq üçün e-poçtunuzu, şifrənizi və autentifikator tətbiqindəki kodu daxil edin.',
  },
  'signed-out': {
    title: 'Sistemdən çıxdınız',
    sub: 'Sessiya bağlandı. Yenidən daxil olmaq üçün məlumatlarınızı daxil edin.',
  },
  expired: {
    title: 'Sessiya başa çatdı',
    sub: 'Təhlükəsizlik üçün uzun müddət fəaliyyətsiz qalan sessiya bağlanır. Yenidən daxil olun.',
  },
};

type FormErrors = {
  email?: string;
  password?: string;
  code?: string;
};

const FIELD_ORDER = ['email', 'password', 'code'] as const;

/** The only page without a session: the design's centred card, with the three things a sign-in needs. */
export default function Login({ reason, unreachable }: { reason: SignedOutReason; unreachable: boolean }) {
  const { signIn } = useSession();
  const [errors, setErrors] = useState<FormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const words = WORDS[reason];

  useEffect(() => {
    document.title = `${words.title} · KidsUp Admin`;
  }, [words.title]);

  // Coming here because the session ended: the focus was lost with the screen, so the heading takes it and is read.
  useEffect(() => {
    if (reason !== 'none') heading.current?.focus();
  }, [reason]);

  // The code is digits only, six at most, whatever is typed or pasted.
  const handleCodeInput = (event: FormEvent<HTMLInputElement>) => {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // What is in the boxes is read when the form is sent and not kept in state: a password manager fills a box
    // without telling the page until the person acts, and the page must send what the person sees.
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const code = String(form.get('code') ?? '').replace(/\D/g, '');
    const found: FormErrors = {};
    if (!email) found.email = 'E-poçtu daxil edin.';
    if (!password) found.password = 'Şifrəni daxil edin.';
    if (!/^\d{6}$/.test(code)) found.code = 'Kod 6 rəqəmdən ibarətdir.';
    setErrors(found);
    setFailure(null);
    const firstInvalid = FIELD_ORDER.find((name) => name in found);
    if (firstInvalid) {
      // The person is taken to the first box that needs attention.
      const box = { email: emailInput, password: passwordInput, code: codeInput }[firstInvalid];
      box.current?.focus();
      return;
    }
    setIsBusy(true);
    try {
      await signIn({ email, password, code });
    } catch (error) {
      setFailure(describeSignIn(error));
      // A one-time code works once: whatever failed, the next attempt needs the next code.
      if (passwordInput.current) passwordInput.current.value = '';
      if (codeInput.current) {
        codeInput.current.value = '';
        codeInput.current.focus();
      }
      setIsBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#F7F7F8',
      }}
    >
      <main
        style={{
          width: 'min(400px,100%)',
          background: '#FFFFFF',
          border: '1px solid #EDEDED',
          borderRadius: 16,
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(26,26,26,.06)',
          animation: 'kaIn .3s ease',
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em' }}>
          Kids<span style={{ color: '#FF0083' }}>Up</span>
        </span>
        <h1 ref={heading} tabIndex={-1} style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
          {words.title}
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#6B6B6B', fontWeight: 500 }}>
          {words.sub}
        </p>

        {unreachable && (
          <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C62828' }}>
            Serverlə əlaqə yoxdur. Bir az sonra səhifəni yeniləyin.
          </p>
        )}

        {/* method="post": if the page's script ever fails to start, the form is not sent in the address. */}
        <form
          method="post"
          onSubmit={handleSubmit}
          noValidate
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            textAlign: 'left',
            marginTop: 6,
          }}
        >
          <Field label="E-poçt" error={errors.email}>
            {(control) => (
              <input
                {...control}
                ref={emailInput}
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                style={inputStyle(!!errors.email)}
              />
            )}
          </Field>
          <Field label="Şifrə" error={errors.password}>
            {(control) => (
              <input
                {...control}
                ref={passwordInput}
                name="password"
                type="password"
                autoComplete="current-password"
                style={inputStyle(!!errors.password)}
              />
            )}
          </Field>
          <Field label="Birdəfəlik kod" error={errors.code}>
            {(control) => (
              <input
                {...control}
                ref={codeInput}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                placeholder="6 rəqəm"
                onInput={handleCodeInput}
                style={{ ...inputStyle(!!errors.code), letterSpacing: '0.2em' }}
              />
            )}
          </Field>

          {failure && (
            <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C62828' }}>
              {failure}
            </p>
          )}

          <button
            type="submit"
            disabled={isBusy}
            {...sx(
              {
                marginTop: 4,
                height: 44,
                padding: '0 22px',
                border: 'none',
                borderRadius: 10,
                background: '#FF0083',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 800,
                opacity: isBusy ? 0.7 : 1,
              },
              { background: '#E00073' },
            )}
          >
            {isBusy ? 'Daxil olunur…' : 'Daxil ol'}
          </button>
        </form>
      </main>
    </div>
  );
}
