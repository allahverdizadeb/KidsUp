import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeCourse, withContent } from '../test/publicContent';
import Brochure from './Brochure';
import Certificate from './Certificate';
import DemoDay from './DemoDay';
import Faq from './Faq';
import Footer from './Footer';
import Founder from './Founder';
import Hero from './Hero';
import Lesson from './Lesson';
import Modules from './Modules';
import Pricing from './Pricing';
import ProgramStats from './ProgramStats';
import Skills from './Skills';

const PICTURE = '/media/00000000-0000-4000-8000-0000000000aa.webp';
const SPRING = makeCourse({
  title: 'Yaz 2027',
  startDate: '2027-03-06',
  schedule: 'bazar, 10:00–13:30',
  location: 'Bakı, Nəsimi rayonu',
  ageMin: 9,
  ageMax: 12,
  priceMinor: 70_000,
  secondChildPriceMinor: 55_000,
  capacity: 16,
});

describe('the page with what the admin panel published', () => {
  describe('texts and numbers', () => {
    it('shows a published headline, subtitle and button label in place of the built-in ones', () => {
      const site = {
        'hero.title_first': 'Yeni başlıq.',
        'hero.title_lead': 'Daha',
        'hero.title_accent': 'böyük.',
        'hero.subtitle': 'Yeni alt başlıq.',
        'hero.primary_cta': 'Qoşul',
      };

      render(<Hero />, { wrapper: withContent({ site }) });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Yeni başlıq.Daha böyük.');
      expect(screen.getByText('Yeni alt başlıq.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Qoşul' })).toHaveAttribute('href', '#muraciet');
      expect(screen.queryByText('Kiçik ideyalar.')).not.toBeInTheDocument();
    });

    it('states the facts of the course on offer in the hero (age, start, time, group size)', () => {
      render(<Hero />, { wrapper: withContent({ courses: [SPRING] }) });

      const facts = within(screen.getByRole('list', { name: 'Əsas məlumatlar' }));
      expect(facts.getByText('9–12 yaş')).toBeInTheDocument();
      expect(facts.getByText('Başlanğıc: 6 mart 2027')).toBeInTheDocument();
      expect(facts.getByText('6 həftə · bazar, 10:00–13:30')).toBeInTheDocument();
      expect(facts.getByText('Maksimum 16 iştirakçı')).toBeInTheDocument();
    });

    it('prices the programme from the course: one child, the second child, both, the saving', () => {
      render(<Pricing />, { wrapper: withContent({ courses: [SPRING] }) });

      expect(screen.getByText('700')).toBeInTheDocument();
      expect(screen.getByText(/ikinci uşaq üçün qiymət/)).toHaveTextContent('550 AZN');
      expect(screen.getByText('1 400 AZN')).toHaveStyle({ textDecoration: 'line-through' });
      expect(screen.getByText('1 250 AZN')).toBeInTheDocument();
      expect(screen.getByText('150 AZN qənaət — 10,7% ailə endirimi')).toBeInTheDocument();
      expect(screen.getByText('6 mart 2027')).toBeInTheDocument();
      expect(screen.getByText('bazar, 10:00–13:30')).toBeInTheDocument();
      expect(screen.getByText('9–12')).toBeInTheDocument();
      expect(screen.getByText('maksimum 16 uşaq')).toBeInTheDocument();
      expect(screen.getByText('Bakı, Nəsimi rayonu')).toBeInTheDocument();
    });

    it('talks about the first course that still takes applications, else about the first one listed', () => {
      const full = makeCourse({ priceMinor: 90_000, isAcceptingApplications: false, seatsLeft: 0 });
      render(<Pricing />, { wrapper: withContent({ courses: [full, SPRING] }) });
      expect(screen.getByText('700')).toBeInTheDocument();
    });

    it('keeps the built-in programme when no course is open or the list could not be read', () => {
      for (const courses of [null, []]) {
        const { unmount } = render(<Pricing />, { wrapper: withContent({ courses }) });
        expect(screen.getByText('650')).toBeInTheDocument();
        expect(screen.getByText('5 dekabr 2026')).toBeInTheDocument();
        unmount();
      }
    });

    it('fills the prices and the group size into the questions and the answers', async () => {
      const user = userEvent.setup({ delay: null });
      render(<Faq />, { wrapper: withContent({ courses: [SPRING] }) });

      expect(screen.getByRole('button', { name: /^700 AZN ödənişə nələr daxildir\?/ })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^Bir qrupda neçə uşaq olacaq/ }));
      expect(screen.getByText(/Qrupda maksimum 16 uşaq olacaq/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^İki övladımı qeydiyyatdan keçirsəm/ }));
      expect(screen.getByText(/ikinci uşaq üçün 550 AZN-dir/).parentElement).toHaveTextContent(
        'İki övlad üçün ümumi ödəniş 1 400 AZN əvəzinə 1 250 AZN olur — ailəniz üçün 150 AZN, yəni təxminən 10,7% endirim.',
      );
      expect(screen.getByText('1 250 AZN')).toHaveStyle({ fontWeight: '800' });
    });

    it('shows published questions, with **bold** words bold', () => {
      const items = [{ q: 'Yeni sual?', a: 'Bəli, **çox** yaxşıdır.' }];

      render(<Faq />, { wrapper: withContent({ site: { 'faq.items': items } }) });

      expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
      expect(screen.getByText('çox').tagName).toBe('SPAN');
      expect(screen.getByRole('button', { name: /Yeni sual\?/ })).toBeInTheDocument();
      expect(screen.queryByText(/Övladım utancaqdır/)).not.toBeInTheDocument();
    });

    it('shows the published figures of the programme and its sections', () => {
      const site = {
        'stats.weeks_value': '8',
        'stats.play_label': 'əyləncə',
        'skills.item_1': 'Birinci bacarıq',
        'demo_day.items': ['Bir', 'İki'],
      };

      render(
        <>
          <ProgramStats />
          <Skills />
          <DemoDay />
        </>,
        { wrapper: withContent({ site }) },
      );

      expect(screen.getByText('həftə').previousSibling).toHaveTextContent('8');
      expect(screen.getByText('əyləncə')).toBeInTheDocument();
      expect(screen.getByText('Birinci bacarıq')).toBeInTheDocument();
      expect(
        within(screen.getByRole('list'))
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Bir', 'İki']);
    });

    it('shows the published modules and lesson steps, as many as there are illustrations', () => {
      const module = (number: number) => ({
        week: `${number}-ci həftə`,
        title: `Başlıq ${number}`,
        desc: 'Təsvir.',
        topics: ['a', 'b', 'c'],
      });
      const step = (number: number) => ({
        time: `10:0${number}–10:1${number}`,
        title: `Addım ${number}`,
        desc: 'Təsvir.',
      });
      const site = {
        'modules.items': [1, 2, 3, 4, 5, 6].map(module),
        'lesson.items': [1, 2, 3, 4, 5, 6, 7, 8].map(step),
      };

      render(
        <>
          <Modules />
          <Lesson />
        </>,
        { wrapper: withContent({ site }) },
      );

      expect(screen.getByText('Başlıq 3')).toBeInTheDocument();
      expect(screen.getByText('3-ci həftə')).toBeInTheDocument();
      expect(screen.getAllByText('Addım 1').length).toBeGreaterThan(0);
    });

    it('goes back to the built-in lists when a published list has the wrong number of steps', () => {
      const site = { 'lesson.items': [{ time: '1', title: 'Yalnız bir', desc: 'x' }] };

      render(<Lesson />, { wrapper: withContent({ site }) });

      expect(screen.queryByText('Yalnız bir')).not.toBeInTheDocument();
      expect(screen.getAllByText('Qarşılama və isinmə').length).toBeGreaterThan(0);
    });
  });

  describe('pictures, links and contacts', () => {
    it('shows a published picture of the founder with its description and link', () => {
      const site = {
        'founder.photo': PICTURE,
        'founder.photo_alt': 'Yeni şəkil',
        'founder.linkedin': 'https://www.linkedin.com/in/someone/',
        'founder.quote_2': 'Mətn **qalın** hissə ilə.',
      };

      render(<Founder />, { wrapper: withContent({ site }) });

      expect(screen.getByAltText('Yeni şəkil')).toHaveAttribute('src', PICTURE);
      expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
        'href',
        'https://www.linkedin.com/in/someone/',
      );
      expect(screen.getByText('qalın').tagName).toBe('B');
    });

    it('shows a published certificate picture on the page and in the dialog', () => {
      render(<Certificate />, { wrapper: withContent({ site: { 'certificate.image': PICTURE } }) });

      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute('src', PICTURE);
      expect(images[0]).toHaveStyle({ objectFit: 'contain' });
    });

    it('offers the published brochure file and button', () => {
      const site = {
        'brochure.file': '/media/00000000-0000-4000-8000-0000000000bb.webp',
        'brochure.button': 'Yüklə',
      };

      render(<Brochure />, { wrapper: withContent({ site }) });

      expect(screen.getByRole('link', { name: /Yüklə/ })).toHaveAttribute(
        'href',
        '/media/00000000-0000-4000-8000-0000000000bb.webp',
      );
    });

    it('uses the published phone and WhatsApp numbers in the footer', () => {
      const site = { 'contact.phone': '+994 55 111 22 33', 'contact.whatsapp': '994551112233' };

      render(<Footer />, { wrapper: withContent({ site }) });

      expect(screen.getByRole('link', { name: '+994 55 111 22 33' })).toHaveAttribute(
        'href',
        'tel:+994551112233',
      );
      expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
        'href',
        'https://wa.me/994551112233',
      );
    });
  });

  describe('what the page refuses to take from the published file (SEC-F-08)', () => {
    it.each([
      ['a script link', { 'founder.linkedin': 'javascript:alert(1)' }],
      ['a link to another scheme', { 'founder.linkedin': 'data:text/html,<script>alert(1)</script>' }],
      ['an address that leaves the site for the photo', { 'founder.photo': 'https://evil.example/x.png' }],
      ['a path that climbs out of the media folder', { 'founder.photo': '/media/../../etc/passwd' }],
      ['a number for a text', { 'founder.role': 5 }],
      ['an empty text', { 'founder.role': '' }],
    ])('keeps the built-in value when the file holds %s', (_what, site) => {
      render(<Founder />, { wrapper: withContent({ site }) });

      expect(screen.getByRole('link', { name: 'LinkedIn' }).getAttribute('href')).toMatch(
        /^https:\/\/www\.linkedin\.com\//,
      );
      expect(screen.getByAltText('Babək Allahverdizadə')).toHaveAttribute('src', '/assets/babek.jpeg');
      expect(screen.getByText('Proqramın qurucusu')).toBeInTheDocument();
    });

    it('shows markup in a published text as plain text, never as markup', () => {
      const site = { 'hero.subtitle': '<img src=x onerror=alert(1)><script>alert(2)</script>' };

      const { container } = render(<Hero />, { wrapper: withContent({ site }) });

      expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('img[onerror]')).toBeNull();
    });
  });
});
