import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RegistrationClosed from './RegistrationClosed';

describe('RegistrationClosed', () => {
  it('says that registration is closed and offers WhatsApp', () => {
    render(
      <RegistrationClosed
        message="Qeydiyyat bağlıdır."
        whatsappUrl="https://wa.me/994509988707"
        linkLabel="WhatsApp"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Müraciət forması');
    expect(screen.getByText('Qeydiyyat bağlıdır.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'WhatsApp' });
    expect(link).toHaveAttribute('href', 'https://wa.me/994509988707');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
