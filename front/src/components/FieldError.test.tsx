import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FieldError from './FieldError';

describe('FieldError', () => {
  it('shows the message as text under the id a field can point at', () => {
    render(<FieldError id="f-parent-err" message="Adınızı qeyd edin." />);
    expect(screen.getByText('Adınızı qeyd edin.')).toHaveAttribute('id', 'f-parent-err');
  });

  it('is read as just the message by the field it is attached to, without the red "!" badge', () => {
    render(
      <>
        <input aria-label="Valideynin adı" aria-describedby="f-parent-err" />
        <FieldError id="f-parent-err" message="Adınızı qeyd edin." />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Valideynin adı' })).toHaveAccessibleDescription(
      'Adınızı qeyd edin.',
    );
  });
});
