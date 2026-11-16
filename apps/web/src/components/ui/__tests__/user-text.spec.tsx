import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserText, IsolatedText } from '../user-text';

describe('UserText and IsolatedText components', () => {
  it('renders UserText with dir="auto" attribute and logical text-start class', () => {
    const { container } = render(
      <UserText data-testid="user-text">
        نص عربي تم إنشاؤه بواسطة المستخدم
      </UserText>,
    );

    const el = screen.getByTestId('user-text');
    expect(el).toHaveAttribute('dir', 'auto');
    expect(el).toHaveClass('text-start');
    expect(container.firstChild).toBe(el);
  });

  it('renders UserText with custom element tag and preserves dir="auto"', () => {
    render(
      <UserText as="p" data-testid="user-p">
        Paragraphe généré par l’utilisateur
      </UserText>,
    );

    const el = screen.getByTestId('user-p');
    expect(el.tagName.toLowerCase()).toBe('p');
    expect(el).toHaveAttribute('dir', 'auto');
  });

  it('renders IsolatedText using <bdi> to protect mixed-script text isolation', () => {
    render(
      <div data-testid="container">
        Bienvenue à <IsolatedText data-testid="bdi-snippet">أحمد (Ahmed)</IsolatedText>!
      </div>,
    );

    const bdi = screen.getByTestId('bdi-snippet');
    expect(bdi.tagName.toLowerCase()).toBe('bdi');
    expect(bdi).toHaveTextContent('أحمد (Ahmed)');
  });
});
