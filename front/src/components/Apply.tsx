import { Fragment, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { submitApplication } from '../api/applications';
import { RegistrationClosedError } from '../api/registrationClosed';
import { PRIVACY_NOTICE_VERSION } from '../content/privacyNotice';
import { useHover } from '../hooks/useHover';
import { useOpenCourses, useText } from '../hooks/usePublicContent';
import { ageOn, courseFacts, courseFigures, DEFAULT_COURSE, formatDate } from '../lib/figures';
import FieldError from './FieldError';
import PrivacyConsent, { CONSENT_BOX_ID } from './PrivacyConsent';
import RegistrationClosed from './RegistrationClosed';

const LANGUAGES = ['Azərbaycan', 'Rus', 'İngilis'];
// What the fallback link says. It carries a plain greeting and never any parent or child details (SEC-F-06):
// a URL ends up in browser history and in WhatsApp's own systems.
const WHATSAPP_GREETING = 'Salam! KidsUp proqramına müraciət etmək istəyirəm.';
const WHATSAPP_FALLBACK_LABEL = 'WhatsApp ilə bizə yaz';
const ERROR_COLOR = '#B00060';
const FIELD_COLOR = '#1A1A1A';

type Kid = { name: string; dob: string };
type KidErrors = { name?: string; dob?: string };
type Errors = { parent?: string; phone?: string; langs?: string; consent?: string; kids: KidErrors[] };
type FieldName = 'parent' | 'phone' | 'langs' | 'consent';
type KidFieldName = 'name' | 'dob';
type Status = 'idle' | 'sending' | 'sent' | 'failed' | 'closed';

function validate(parent: string, phone: string, kids: Kid[], langs: string[], isConsentGiven: boolean) {
  const e: Errors = { kids: kids.map(() => ({})) };
  if (!parent.trim()) e.parent = 'Adınızı qeyd edin.';
  const digits = phone.replace(/\D/g, '');
  if (!digits) e.phone = 'Əlaqə nömrənizi qeyd edin.';
  // Same rule as the API (back/app/schemas/application.py): phone characters only, 9–12 digits.
  else if (!/^[\d\s+()-]+$/.test(phone.trim()) || digits.length < 9 || digits.length > 12)
    e.phone = 'Nömrəni tam yazın, məsələn: +994 50 123 45 67.';
  kids.forEach((k, i) => {
    if (!k.name.trim()) e.kids[i].name = 'Uşağın adını və soyadını qeyd edin.';
    if (!k.dob) e.kids[i].dob = 'Doğum tarixini seçin.';
  });
  if (!langs.length) e.langs = 'Ən azı bir təlim dili seçin.';
  if (!isConsentGiven) e.consent = 'Davam etmək üçün razılığınızı təsdiq edin.';

  let firstId: string | null = null;
  if (e.parent) firstId = 'f-parent';
  else if (e.phone) firstId = 'f-phone';
  else {
    for (let i = 0; i < kids.length && !firstId; i++) {
      if (e.kids[i].name) firstId = 'kn' + i;
      else if (e.kids[i].dob) firstId = 'kd' + i;
    }
    if (!firstId && e.langs) firstId = 'f-lang-l';
    if (!firstId && e.consent) firstId = CONSENT_BOX_ID;
  }
  return { errors: e, firstId };
}

/** Copy of the errors without one field's message (called as the user fixes that field). */
function withoutFieldError(errors: Errors | null, field: FieldName): Errors | null {
  if (!errors) return null;
  const next: Errors = { ...errors, kids: errors.kids.map((k) => ({ ...k })) };
  delete next[field];
  return next;
}

/** Copy of the errors without one child field's message. */
function withoutKidError(errors: Errors | null, kid: number, field: KidFieldName): Errors | null {
  if (!errors) return null;
  const next: Errors = { ...errors, kids: errors.kids.map((k) => ({ ...k })) };
  if (next.kids[kid]) delete next.kids[kid][field];
  return next;
}

export default function Apply() {
  const { on, off, hv } = useHover(['i6']);
  const [parent, setParent] = useState('');
  const [phone, setPhone] = useState('');
  const [kidList, setKidList] = useState<Kid[]>([{ name: '', dob: '' }]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['Azərbaycan']);
  const [isConsentGiven, setIsConsentGiven] = useState(false);
  const [err, setErr] = useState<Errors | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [pickedCourseId, setPickedCourseId] = useState('');
  const phoneNumber = useText('contact.phone');
  const whatsappNumber = useText('contact.whatsapp');
  const headingLead = useText('apply.heading_lead');
  const headingAccent = useText('apply.heading_accent');
  const headingTail = useText('apply.heading_tail');
  const intro = useText('apply.intro');
  const whatsappLabel = useText('apply.whatsapp_label');
  const successMessage = useText('apply.success');
  const closedMessage = useText('apply.closed');

  // The course applied for: the one picked, else the first that takes applications. Nothing is picked while the
  // list of courses is unknown (the API then takes the one open course).
  const openCourses = useOpenCourses();
  const course = openCourses?.find((option) => option.id === pickedCourseId) ?? openCourses?.[0];
  const facts = course ? courseFacts(course) : DEFAULT_COURSE;
  const figures = courseFigures(facts);
  const whatsapp = `https://wa.me/${whatsappNumber}`;
  const whatsappFallback = `${whatsapp}?text=${encodeURIComponent(WHATSAPP_GREETING)}`;

  const sending = status === 'sending';
  const sent = status === 'sent';
  const failed = status === 'failed';
  const isClosed = status === 'closed' || openCourses?.length === 0;
  const hasError = !!error;
  // Editing a field clears a previous failure, but never the "sent" confirmation.
  const edited = () => setStatus((s) => (s === 'failed' ? 'idle' : s));

  const er: Errors = err ?? { kids: [] };
  const border = (message?: string) => (message ? ERROR_COLOR : FIELD_COLOR);

  const setKid = (i: number, patch: Partial<Kid>, field: KidFieldName) => {
    setKidList((list) => list.map((k, j) => (j === i ? { ...k, ...patch } : k)));
    setErr((e) => withoutKidError(e, i, field));
    edited();
  };

  const kids = kidList.map((k, i) => {
    const age = ageOn(k.dob, facts.startDate);
    const ageOk = age !== null && age >= facts.ageMin && age <= facts.ageMax;
    const ke = er.kids[i] ?? {};
    return {
      name: k.name,
      dob: k.dob,
      title: `${i + 1}-ci uşaq`,
      removable: i > 0,
      removeLabel: `${i + 1}-ci uşağı sil`,
      nameId: 'kn' + i,
      dobId: 'kd' + i,
      nameErrorId: `kn${i}-err`,
      dobErrorId: `kd${i}-err`,
      eName: ke.name ?? '',
      eNameOn: !!ke.name,
      nameInv: !!ke.name,
      nameB: border(ke.name),
      eDob: ke.dob ?? '',
      eDobOn: !!ke.dob,
      dobInv: !!ke.dob,
      dobB: border(ke.dob),
      remove: () => {
        setKidList((list) => list.filter((_, j) => j !== i));
        setErr((e) => (e ? { ...e, kids: e.kids.filter((_, j) => j !== i) } : null));
        edited();
        setTimeout(
          () => document.querySelector<HTMLButtonElement>('#muraciet button[type="button"]')?.focus(),
          0,
        );
      },
      onName: (e: ChangeEvent<HTMLInputElement>) => setKid(i, { name: e.target.value }, 'name'),
      onDob: (e: ChangeEvent<HTMLInputElement>) => setKid(i, { dob: e.target.value }, 'dob'),
      hasAge: age !== null,
      ageNote:
        age === null
          ? ''
          : ageOk
            ? `Proqram başlayanda: ${age} yaş`
            : `Proqram başlayanda: ${age} yaş. Proqram ${facts.ageMin}–${facts.ageMax} yaş üçündür.`,
      ageColor: ageOk ? '#4A4A4A' : ERROR_COLOR,
    };
  });

  const langs = LANGUAGES.map((v) => {
    const isOn = selectedLangs.includes(v);
    return {
      v,
      on: isOn,
      mark: isOn ? '✓' : '',
      boxB: isOn ? '#FFFFFF' : '#1A1A1A',
      boxBg: isOn ? '#FFFFFF' : 'transparent',
      bg: isOn ? '#FF0083' : '#FFFFFF',
      fg: isOn ? '#FFFFFF' : '#1A1A1A',
      border: isOn ? '#FF0083' : '#1A1A1A',
      pick: () => {
        setSelectedLangs((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
        setErr((e) => withoutFieldError(e, 'langs'));
        edited();
      },
    };
  });

  const canAddKid = kidList.length < 2;
  const twoKids = kidList.length === 2;
  const addKid = () => {
    if (!canAddKid) return;
    setKidList((list) => [...list, { name: '', dob: '' }]);
    setErr((e) => (e ? { ...e, kids: [...e.kids, {}] } : null));
    edited();
    setTimeout(() => document.getElementById('kn1')?.focus(), 0);
  };

  const handleCourseChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPickedCourseId(event.target.value);
    edited();
  };

  const handleConsentChange = (isChecked: boolean) => {
    setIsConsentGiven(isChecked);
    setErr((x) => withoutFieldError(x, 'consent'));
    edited();
  };
  const onParent = (e: ChangeEvent<HTMLInputElement>) => {
    setParent(e.target.value);
    setErr((x) => withoutFieldError(x, 'parent'));
    edited();
  };
  const onPhone = (e: ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
    setErr((x) => withoutFieldError(x, 'phone'));
    edited();
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (sending || sent) return;
    const { errors, firstId } = validate(parent, phone, kidList, selectedLangs, isConsentGiven);
    if (firstId) {
      setErr(errors);
      setError('Zəhmət olmasa qeyd olunan sahələri düzəldin.');
      setStatus('idle');
      setTimeout(() => document.getElementById(firstId)?.focus(), 0);
      return;
    }
    setErr(null);
    setError('');
    setStatus('sending');
    try {
      await submitApplication({
        parent_name: parent.trim(),
        phone: phone.trim(),
        children: kidList.map((k) => ({ name: k.name.trim(), birth_date: k.dob })),
        languages: LANGUAGES.filter((l) => selectedLangs.includes(l)),
        ...(course ? { course_id: course.id } : {}),
        consent: true,
        privacy_notice_version: PRIVACY_NOTICE_VERSION,
      });
      setStatus('sent');
    } catch (failure) {
      // The course stopped taking applications while the form was open (closed, or its last seat went).
      setStatus(failure instanceof RegistrationClosedError ? 'closed' : 'failed');
      setError(failure instanceof RegistrationClosedError ? '' : 'Müraciət göndərilmədi.');
    }
  };

  const eParent = er.parent ?? '';
  const eParentOn = !!er.parent;
  const eParentInv = !!er.parent;
  const eParentB = border(er.parent);
  const ePhone = er.phone ?? '';
  const ePhoneOn = !!er.phone;
  const ePhoneInv = !!er.phone;
  const ePhoneB = border(er.phone);
  const eLangs = er.langs ?? '';
  const eLangsOn = !!er.langs;
  const consentError = er.consent ?? '';

  const submitLabel = sending ? 'Göndərilir…' : sent ? '✓ Müraciət göndərildi' : 'Göndər';
  const submitBg = sending || sent ? '#6B6B6B' : '#FF0083';
  const submitCur = sending || sent ? 'default' : 'pointer';

  return (
    <section id="muraciet" style={{ background: '#FFFFFF' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))',
          gap: '56px 96px',
          alignItems: 'start',
        }}
      >
        <div data-reveal="1" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h2
            style={{
              margin: '0',
              fontWeight: '800',
              fontSize: 'clamp(40px,6vw,84px)',
              letterSpacing: '-0.045em',
              lineHeight: '0.98',
            }}
          >
            {headingLead} <span style={{ color: '#FF0083' }}>{headingAccent}</span> {headingTail}
          </h2>
          <p
            style={{ margin: '0', fontSize: '18px', lineHeight: '1.6', color: '#4A4A4A', maxWidth: '480px' }}
          >
            {intro}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 24px',
                border: '2px solid #1A1A1A',
                borderRadius: '6px',
                color: '#1A1A1A',
                fontWeight: '800',
                fontSize: '17px',
                transition: 'background .15s',
              }}
              className="hv-5"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
                <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z" />
              </svg>
              {whatsappLabel}
            </a>
            <a
              href={`tel:+${phoneNumber.replace(/\D/g, '')}`}
              style={{ fontSize: '18px', fontWeight: '700', color: '#1A1A1A' }}
              className="hv-1"
            >
              {phoneNumber}
            </a>
          </div>
          <div onPointerEnter={on.i6} onPointerLeave={off} style={{ marginTop: '24px' }}>
            <svg
              viewBox="0 0 560 360"
              width="100%"
              role="img"
              aria-label="Açıq dəftərdə ideya eskizi, yanında qələm və dəftərdən uçan çəhrayı kağız təyyarə"
              fill="none"
              stroke="#4A4A4A"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block', maxWidth: '520px' }}
            >
              <ellipse cx="222" cy="334" rx="200" ry="16" fill="#000000" fillOpacity="0.06" stroke="none" />
              <path
                d="M54 324 Q140 300 228 290 Q306 300 388 324 L388 336 Q306 312 228 302 Q140 312 54 336 Z"
                fill="#EDEDED"
              />
              <path d="M40 200 Q130 172 222 168 L228 290 Q140 300 54 324 Z" fill="#FFFFFF" />
              <path d="M222 168 Q312 176 400 200 L388 324 Q306 300 228 290 Z" fill="#FFFFFF" />
              <path d="M222 168 L228 290" stroke="#BDBDBD" />
              <g strokeWidth="2" style={{ stroke: hv.i6bulb, transition: 'stroke .25s ease' }}>
                <circle cx="132" cy="226" r="22" />
                <path d="M122 254 H142 M124 264 H140 M132 190 V182 M100 204 L94 198 M164 204 L170 198" />
              </g>
              <g stroke="#B0B0B0" strokeWidth="2">
                <path d="M252 210 Q310 214 370 226" />
                <path d="M252 232 Q306 236 360 246" />
                <path d="M252 254 Q300 258 346 266" />
              </g>
              <path d="M262 316 L392 262" stroke="#4A4A4A" strokeWidth="12" />
              <path d="M262 316 L392 262" stroke="#FFFFFF" strokeWidth="7" />
              <path d="M262 316 L246 324 L256 308" fill="#4A4A4A" />
              <path d="M300 220 Q370 150 432 126" strokeDasharray="2 9" />
              <g
                style={{
                  transform: hv.i6t,
                  transition: 'transform .25s ease',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              >
                <path d="M436 124 L540 58 L486 132 Z" fill="#FF0083" />
                <path d="M486 132 L540 58 L494 154 Z" fill="#C8006A" />
                <path d="M486 132 L494 154" strokeWidth="2" />
              </g>
            </svg>
          </div>
        </div>
        {isClosed && (
          <RegistrationClosed
            message={closedMessage}
            whatsappUrl={whatsappFallback}
            linkLabel={WHATSAPP_FALLBACK_LABEL}
          />
        )}
        {!isClosed && (
          <form
            data-reveal="1"
            noValidate={true}
            onSubmit={submit}
            aria-label="Müraciət forması"
            style={{
              margin: '0',
              border: '2px solid #1A1A1A',
              borderRadius: '6px',
              padding: 'clamp(20px,3.5vw,44px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontWeight: '800', fontSize: '22px', letterSpacing: '-0.01em' }}>
                Müraciət forması
              </div>
              <div style={{ fontSize: '14px', color: '#6B6B6B' }}>Bütün sahələri doldurun.</div>
            </div>
            {openCourses && openCourses.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="f-course" style={{ fontWeight: '700', fontSize: '15px' }}>
                  Hansı qrupa müraciət edirsiniz?
                </label>
                <select
                  id="f-course"
                  value={course?.id ?? ''}
                  onChange={handleCourseChange}
                  style={{
                    fontFamily: 'inherit',
                    height: '56px',
                    borderRadius: '6px',
                    padding: '0 16px',
                    fontSize: '17px',
                    fontWeight: '600',
                    color: '#1A1A1A',
                    outline: 'none',
                    background: '#FFFFFF',
                    width: '100%',
                    boxSizing: 'border-box',
                    border: `1.5px solid ${FIELD_COLOR}`,
                  }}
                  className="fc-2"
                >
                  {openCourses.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} · {formatDate(option.startDate)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="f-parent" style={{ fontWeight: '700', fontSize: '15px' }}>
                Valideynin adı
              </label>
              <input
                id="f-parent"
                maxLength={120}
                value={parent}
                onChange={onParent}
                autoComplete="name"
                aria-invalid={eParentInv}
                aria-describedby={eParentOn ? 'f-parent-err' : undefined}
                style={{
                  height: '56px',
                  borderRadius: '6px',
                  padding: '0 16px',
                  fontSize: '17px',
                  fontWeight: '600',
                  color: '#1A1A1A',
                  outline: 'none',
                  background: '#FFFFFF',
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1.5px solid ${eParentB}`,
                }}
                className="fc-2"
              />
              {eParentOn && <FieldError id="f-parent-err" message={eParent} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="f-phone" style={{ fontWeight: '700', fontSize: '15px' }}>
                Əlaqə nömrəsi
              </label>
              <input
                id="f-phone"
                maxLength={32}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={onPhone}
                placeholder="+994 50 123 45 67"
                autoComplete="tel"
                aria-invalid={ePhoneInv}
                aria-describedby={ePhoneOn ? 'f-phone-err' : undefined}
                style={{
                  height: '56px',
                  borderRadius: '6px',
                  padding: '0 16px',
                  fontSize: '17px',
                  fontWeight: '600',
                  color: '#1A1A1A',
                  outline: 'none',
                  background: '#FFFFFF',
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1.5px solid ${ePhoneB}`,
                }}
                className="fc-2"
              />
              {ePhoneOn && <FieldError id="f-phone-err" message={ePhone} />}
            </div>
            {kids.map((k, __i) => (
              <Fragment key={__i}>
                <fieldset
                  style={{
                    margin: '0',
                    border: '1.5px dashed #BDBDBD',
                    borderRadius: '6px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    minWidth: '0',
                  }}
                >
                  <legend
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                    }}
                  >
                    {k.title}
                  </legend>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      minHeight: '44px',
                    }}
                  >
                    <span aria-hidden="true" style={{ fontWeight: '800', fontSize: '16px' }}>
                      {k.title}
                    </span>
                    {k.removable && (
                      <>
                        <button
                          type="button"
                          onClick={k.remove}
                          aria-label={k.removeLabel}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: '0 4px',
                            minHeight: '44px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '14px',
                            color: '#4A4A4A',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px',
                          }}
                          className="hv-1"
                        >
                          Sil
                        </button>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label htmlFor={k.nameId} style={{ fontWeight: '700', fontSize: '15px' }}>
                      Uşağın adı və soyadı
                    </label>
                    <input
                      id={k.nameId}
                      maxLength={120}
                      value={k.name}
                      onChange={k.onName}
                      autoComplete="off"
                      aria-invalid={k.nameInv}
                      aria-describedby={k.eNameOn ? k.nameErrorId : undefined}
                      style={{
                        height: '56px',
                        borderRadius: '6px',
                        padding: '0 16px',
                        fontSize: '17px',
                        fontWeight: '600',
                        color: '#1A1A1A',
                        outline: 'none',
                        background: '#FFFFFF',
                        width: '100%',
                        boxSizing: 'border-box',
                        border: `1.5px solid ${k.nameB}`,
                      }}
                      className="fc-2"
                    />
                    {k.eNameOn && <FieldError id={k.nameErrorId} message={k.eName} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label htmlFor={k.dobId} style={{ fontWeight: '700', fontSize: '15px' }}>
                      Doğum tarixi
                    </label>
                    <input
                      id={k.dobId}
                      type="date"
                      value={k.dob}
                      onChange={k.onDob}
                      min="2010-01-01"
                      max="2020-12-31"
                      autoComplete="off"
                      aria-invalid={k.dobInv}
                      aria-describedby={k.eDobOn ? k.dobErrorId : undefined}
                      style={{
                        height: '56px',
                        borderRadius: '6px',
                        padding: '0 16px',
                        fontSize: '17px',
                        fontWeight: '600',
                        color: '#1A1A1A',
                        outline: 'none',
                        background: '#FFFFFF',
                        width: '100%',
                        boxSizing: 'border-box',
                        border: `1.5px solid ${k.dobB}`,
                        accentColor: '#FF0083',
                        colorScheme: 'light',
                        cursor: 'pointer',
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        display: 'block',
                      }}
                      className="fc-2"
                    />
                    {k.eDobOn && <FieldError id={k.dobErrorId} message={k.eDob} />}
                    {k.hasAge && (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: k.ageColor }}>
                          {k.ageNote}
                        </div>
                      </>
                    )}
                  </div>
                </fieldset>
              </Fragment>
            ))}
            {canAddKid && (
              <>
                <button
                  type="button"
                  onClick={addKid}
                  style={{
                    height: '52px',
                    borderRadius: '6px',
                    border: '1.5px solid #1A1A1A',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '16px',
                    color: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'background .15s, color .15s',
                  }}
                  className="hv-5"
                >
                  <span aria-hidden="true" style={{ fontSize: '22px', lineHeight: '1' }}>
                    +
                  </span>
                  İkinci uşağı əlavə et
                </button>
              </>
            )}
            {twoKids && (
              <>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1A1A1A',
                    background: '#FFF0F7',
                    borderRadius: '6px',
                    padding: '10px 14px',
                  }}
                >
                  Ailə endirimi: iki uşaq üçün <b>{figures.price_family}</b> ({figures.price_saving} qənaət)
                </div>
              </>
            )}
            <div
              role="group"
              aria-labelledby="f-lang-l"
              aria-describedby="f-lang-h f-lang-err"
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span id="f-lang-l" style={{ fontWeight: '700', fontSize: '15px' }}>
                  Üstünlük verilən təlim dili
                </span>
                <span id="f-lang-h" style={{ fontWeight: '500', fontSize: '14px', color: '#6B6B6B' }}>
                  Bir və ya bir neçə dil seçə bilərsiniz
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,110px),1fr))',
                  gap: '6px',
                }}
              >
                {langs.map((l, __i) => (
                  <Fragment key={__i}>
                    <button
                      type="button"
                      onClick={l.pick}
                      aria-pressed={l.on}
                      style={{
                        height: '52px',
                        borderRadius: '6px',
                        border: `1.5px solid ${l.border}`,
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '16px',
                        background: l.bg,
                        color: l.fg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'background .2s, color .2s, border-color .2s',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `1.5px solid ${l.boxB}`,
                          background: l.boxBg,
                          color: '#FF0083',
                          fontSize: '13px',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {l.mark}
                      </span>
                      {l.v}
                    </button>
                  </Fragment>
                ))}
              </div>
              {eLangsOn && <FieldError id="f-lang-err" message={eLangs} />}
            </div>
            <PrivacyConsent isChecked={isConsentGiven} error={consentError} onChange={handleConsentChange} />
            {hasError && (
              <>
                <div
                  role="alert"
                  style={{
                    fontSize: '15px',
                    fontWeight: '700',
                    color: '#B00060',
                    background: '#FFF0F7',
                    border: '1.5px solid #B00060',
                    borderRadius: '6px',
                    padding: '12px 14px',
                  }}
                >
                  {error}
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={sending || sent}
              style={{
                height: '60px',
                borderRadius: '6px',
                border: 'none',
                cursor: submitCur,
                background: submitBg,
                color: '#FFFFFF',
                fontWeight: '800',
                fontSize: '18px',
                transition: 'background .15s',
              }}
            >
              {submitLabel}
            </button>
            {sent && (
              <div
                role="status"
                style={{
                  padding: '18px',
                  borderRadius: '6px',
                  background: '#FFF0F7',
                  fontSize: '15px',
                  lineHeight: '1.55',
                  fontWeight: '700',
                  color: '#1A1A1A',
                }}
              >
                {successMessage}
              </div>
            )}
            {failed && (
              <>
                <div
                  role="status"
                  style={{
                    padding: '18px',
                    borderRadius: '6px',
                    background: '#FFF0F7',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontSize: '15px', lineHeight: '1.55', color: '#1A1A1A' }}>
                    Müraciətiniz hələ göndərilməyib. Bir az sonra yenidən cəhd edin və ya WhatsApp ilə bizə
                    yazın.
                  </div>
                  <a
                    href={whatsappFallback}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: '48px',
                      padding: '0 20px',
                      borderRadius: '6px',
                      background: '#1A1A1A',
                      color: '#FFFFFF',
                      fontWeight: '800',
                      fontSize: '16px',
                    }}
                    className="hv-11"
                  >
                    {WHATSAPP_FALLBACK_LABEL}
                  </a>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
