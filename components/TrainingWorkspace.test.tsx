import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrainingWorkspace from './TrainingWorkspace';

vi.mock('./crm/ObjectionsDrawer', () => ({
  default: () => <div>Objections</div>,
}));

describe('TrainingWorkspace', () => {
  it('switches between all three training podcasts', () => {
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: vi.fn(),
    });

    render(<TrainingWorkspace isDarkMode={false} />);

    expect(screen.getByRole('heading', { name: 'Choose an episode' })).toBeInTheDocument();
    expect(screen.getByText('3 episodes')).toBeInTheDocument();

    const archbold = screen.getByRole('button', { name: /archbold furniture/i });
    fireEvent.click(archbold);
    expect(archbold).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Deep Dive: Archbold Furniture' })).toBeInTheDocument();
    expect(document.querySelector('video source')).toHaveAttribute(
      'src',
      '/fd/api/api/training/media/archbold-deep-dive.mp4',
    );
  });
});
