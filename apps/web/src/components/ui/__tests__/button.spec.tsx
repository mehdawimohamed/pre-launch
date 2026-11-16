import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';

describe('Button component (Design system & Accessibility)', () => {
  it('renders with accessible min-h-[44px] and min-w-[44px] tap target size', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('min-h-[44px]');
    expect(button).toHaveClass('min-w-[44px]');
  });

  it('renders primary variant with proper styling and focus rings', () => {
    render(<Button variant="primary">Confirmer</Button>);
    const button = screen.getByRole('button', { name: 'Confirmer' });
    expect(button).toHaveClass('bg-emerald-600');
    expect(button).toHaveClass('focus-visible:ring-2');
  });

  it('supports disabled state and forwards ref properly', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref} disabled>Désactivé</Button>);
    const button = screen.getByRole('button', { name: 'Désactivé' });
    expect(button).toBeDisabled();
    expect(ref.current).toBe(button);
  });
});
