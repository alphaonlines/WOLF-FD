import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ShopWorkspace from './ShopWorkspace';

vi.mock('./ProductSearchWorkspace', () => ({
  default: () => <div>Product search workspace</div>,
}));

vi.mock('./SmartPricingCalculatorPage', () => ({
  default: () => <div>Smart calc workspace</div>,
}));

describe('ShopWorkspace', () => {
  it('keeps Competitor Pricing out of Shop subtabs and Smart Calc', () => {
    render(<ShopWorkspace isDarkMode={false} onOpenUploadArea={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Product Search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Smart Calc/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /POS/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Competitor Pricing/i })).not.toBeInTheDocument();
    expect(screen.getByText('Smart calc workspace')).toBeInTheDocument();
  });
});
