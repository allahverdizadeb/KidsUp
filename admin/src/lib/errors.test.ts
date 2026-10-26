import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client.ts';
import { contentRuleMessage, describe as describeError, describeSignIn } from './errors.ts';

const refused = (status: number, code: string | null, body: Record<string, unknown> = {}) =>
  new ApiError(status, code, body);

describe('what staff read when something fails', () => {
  it('tells an offline browser from a refusal', () => {
    expect(describeError(new ApiError(0, 'network')).title).toBe('Serverlə əlaqə yoxdur');
  });

  it('has a plain answer for something that is not an API error', () => {
    expect(describeError(new Error('boom')).title).toBe('Gözlənilməz xəta');
    expect(describeError(undefined).title).toBe('Gözlənilməz xəta');
  });

  it('names the seats that are missing', () => {
    expect(describeError(refused(409, 'not_enough_seats', { needed: 2, free_seats: 1 })).sub).toContain(
      'lazım: 2, boş: 1',
    );
  });

  it('explains why an approval cannot be taken back', () => {
    expect(describeError(refused(403, 'approval_locked')).sub).toContain('admin');
  });

  it.each([
    ['application_not_found', 404],
    ['note_not_found', 404],
    ['course_not_found', 404],
    ['media_not_found', 404],
    ['too_many_notes', 409],
    ['capacity_below_approved', 409],
    ['course_has_applications', 409],
    ['media_in_use', 409],
    ['invalid_course', 422],
    ['unknown_content_key', 422],
    ['invalid_image', 422],
    ['too_many_rows', 413],
    ['public_file_failed', 503],
    ['confirmation_required', 422],
    ['busy', 503],
  ])('has words for %s', (code, status) => {
    const problem = describeError(refused(status, code, { maximum: 200, approved_children: 3 }));
    expect(problem.title).not.toBe('Server xətası');
    expect(problem.sub).not.toBe('');
  });

  it('names the place of a text that was refused and why', () => {
    const error = refused(422, 'invalid_content', { key: 'hero.title_first', rule: 'too_long' });
    expect(describeError(error, () => 'Başlıq')).toEqual({
      title: '“Başlıq” saxlanmadı',
      sub: 'Mətn çox uzundur.',
    });
    expect(describeError(error).title).toBe('Mətn saxlanmadı');
  });

  it('says why a picture was refused', () => {
    expect(describeError(refused(422, 'invalid_image', { reason: 'animated' })).sub).toContain('Animasiya');
    expect(describeError(refused(422, 'invalid_image', { reason: 'surprise' })).sub).toContain('JPG');
  });

  it('falls back on the status for anything it has no code for', () => {
    expect(describeError(refused(401, null)).title).toBe('Sessiya başa çatıb');
    expect(describeError(refused(403, null)).title).toBe('İcazə yoxdur');
    expect(describeError(refused(413, null)).title).toBe('Fayl çox böyükdür');
    expect(describeError(refused(422, null)).title).toBe('Məlumat düzgün deyil');
    expect(describeError(refused(429, null)).title).toBe('Çox sorğu göndərildi');
    expect(describeError(refused(500, null)).title).toBe('Server xətası');
  });

  it('has a message for every rule a text can break, and a plain one for a rule it does not know', () => {
    expect(contentRuleMessage('empty')).toBe('Boş qala bilməz.');
    expect(contentRuleMessage('bad_link')).toContain('https://');
    expect(contentRuleMessage('a new rule')).toBe('Dəyər bu sahəyə uyğun deyil.');
    expect(contentRuleMessage(undefined)).toBe('Dəyər bu sahəyə uyğun deyil.');
  });
});

describe('what the sign-in form says', () => {
  it('says one thing for a wrong e-mail, password or code', () => {
    expect(describeSignIn(refused(401, 'invalid_credentials'))).toBe('E-poçt, şifrə və ya kod yanlışdır.');
  });

  it('says what is wrong with the way it was filled in, how often it was tried, and where it came from', () => {
    expect(describeSignIn(refused(422, null))).toContain('6 rəqəmli');
    expect(describeSignIn(refused(429, null))).toContain('Çox cəhd');
    expect(describeSignIn(refused(403, null))).toContain('ünvandan');
    expect(describeSignIn(refused(500, null))).toContain('Server cavab vermir');
    expect(describeSignIn(new ApiError(0, 'network'))).toContain('İnternet');
    expect(describeSignIn(new Error('x'))).toContain('alınmadı');
  });
});
