import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NavItem from './NavItem';

describe('NavItem', () => {
  it('renders the label when open', () => {
    render(
      <NavItem
        icon={<span>Icon</span>}
        label="Test Label"
        isActive={false}
        isOpen={true}
        isDarkMode={false}
        onClick={() => {}}
      />
    );
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('does not render the label text when closed', () => {
    render(
      <NavItem
        icon={<span>Icon</span>}
        label="Test Label"
        isActive={false}
        isOpen={false}
        isDarkMode={false}
        onClick={() => {}}
      />
    );
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(
      <NavItem
        icon={<span>Icon</span>}
        label="Test Label"
        isActive={false}
        isOpen={true}
        isDarkMode={false}
        onClick={handleClick}
      />
    );
    screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
