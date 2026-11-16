import React from 'react';
import { cn } from '@/lib/utils';

export interface UserTextProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  as?: 'div' | 'p' | 'span' | 'article' | 'section';
}

/**
 * Renders user-generated content safely inside the LTR application shell.
 * Sets dir="auto" on the container so paragraphs naturally align according to their script,
 * and handles text-start logical alignment.
 */
export function UserText({
  children,
  className,
  as: Component = 'div',
  ...props
}: UserTextProps) {
  return (
    <Component
      dir="auto"
      className={cn('text-start leading-relaxed break-words', className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface IsolatedTextProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * Wraps user-supplied names, campaign titles, or mixed-script snippets in <bdi>.
 * Isolates bidirectional text from the surrounding layout to prevent punctuation/number bleeding.
 */
export function IsolatedText({ children, className, ...props }: IsolatedTextProps) {
  return (
    <bdi className={cn('inline-block', className)} {...props}>
      {children}
    </bdi>
  );
}
