import { Component } from 'react';
import type { ReactNode } from 'react';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

/**
 * Last line of defence (SEC-F-14): a crash in one section must not blank the whole page or leak details.
 * The fallback shows no error text, only a way to reach the team.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main
        role="alert"
        style={{ maxWidth: '640px', margin: '20vh auto', padding: '0 24px', textAlign: 'center' }}
      >
        <h1 style={{ fontSize: '32px', letterSpacing: '-0.03em', margin: '0 0 16px' }}>
          Kids<span style={{ color: '#FF0083' }}>Up</span>
        </h1>
        <p style={{ fontSize: '18px', lineHeight: 1.6, color: '#4A4A4A' }}>
          Səhifəni göstərmək mümkün olmadı. Zəhmət olmasa səhifəni yeniləyin və ya bizimlə əlaqə saxlayın.
        </p>
        <p style={{ fontSize: '18px', fontWeight: 700 }}>
          <a href="https://wa.me/994509988707" rel="noopener noreferrer" target="_blank">
            WhatsApp
          </a>
          {' · '}
          <a href="tel:+994509988707">+994 50 998 87 07</a>
        </p>
      </main>
    );
  }
}
