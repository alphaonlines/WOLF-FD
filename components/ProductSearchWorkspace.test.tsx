import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManufacturerCatalogItem } from '../types';
import { fetchManufacturerCatalog } from '../services/manufacturerPricelistApi';
import ProductSearchWorkspace from './ProductSearchWorkspace';

vi.mock('../services/manufacturerPricelistApi', () => ({
  fetchManufacturerCatalog: vi.fn(),
  fetchManufacturerReferenceNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock('./ProductPriceMatchPanel', () => ({
  default: () => <div>Price Match panel</div>,
}));

const catalogItem: ManufacturerCatalogItem = {
  id: '44',
  manufacturer: 'Jackson',
  manufacturerSlug: 'jackson',
  collectionCode: 'CAT',
  collectionName: 'Catnapper',
  category: 'Living Room',
  productType: 'Recliner',
  sku: 'CAT-100',
  description: 'Power Recliner',
  colorFinish: 'Slate',
  colorFamily: 'Gray',
  material: 'Fabric',
  shape: '',
  dimensionsText: '40W × 42D × 44H',
  widthInches: 40,
  depthInches: 42,
  heightInches: 44,
  cubes: null,
  weightLbs: null,
  basePrice: 500,
  isSet: false,
  setPieceCount: null,
  isSwatch: false,
  isSample: false,
  isNewProduct: false,
  upholsteryCover: '',
  hardwareOptions: [],
  cushionOptions: [],
  featureTags: [],
  searchKeywords: [],
  imageUrls: [],
  sourceNote: '',
  sourceSortOrder: 1,
};

describe('ProductSearchWorkspace item dialog', () => {
  beforeEach(() => {
    vi.mocked(fetchManufacturerCatalog).mockResolvedValue({
      rows: [catalogItem],
      total: 1,
      count: 1,
      limit: 1000,
      hasMore: false,
    });
  });

  it('portals Price Match to the document body so transformed dashboard ancestors cannot offset it', async () => {
    render(
      <div style={{ filter: 'blur(0px)' }}>
        <ProductSearchWorkspace isDarkMode={false} />
      </div>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Price Match' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close item dialog' })).toHaveFocus());

    const dialog = screen.getByRole('dialog', { name: 'Power Recliner' });
    expect(screen.getByText('Price Match panel')).toBeInTheDocument();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });
});
