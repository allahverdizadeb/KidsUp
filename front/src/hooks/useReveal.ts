import { useEffect } from 'react';
import { prefersReducedMotion } from '../lib/hover';

const show = (el: HTMLElement) => {
  el.style.opacity = '1';
  el.style.transform = 'none';
};

/**
 * Fades in every [data-reveal] element as it scrolls into view.
 * Elements already on screen are never hidden, and everything is shown after 2.5s as a safety net.
 */
export function useReveal(): void {
  useEffect(() => {
    const all = () => document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target as HTMLElement);
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.05 },
    );

    const hideBelowFold = setTimeout(() => {
      const vh = window.innerHeight;
      if (!vh || vh < 200) return;
      all().forEach((el) => {
        if (el.getBoundingClientRect().top < vh + 80) return;
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'opacity .6s ease, transform .6s ease';
        observer.observe(el);
      });
    }, 60);

    const onScroll = () =>
      all().forEach((el) => {
        if (el.style.opacity === '0' && el.getBoundingClientRect().top < window.innerHeight) show(el);
      });
    window.addEventListener('scroll', onScroll, { passive: true });
    const showAll = setTimeout(() => all().forEach(show), 2500);

    return () => {
      clearTimeout(hideBelowFold);
      clearTimeout(showAll);
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
      all().forEach(show);
    };
  }, []);
}
