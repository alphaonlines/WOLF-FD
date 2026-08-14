import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompetitorPricingWorkspace from './CompetitorPricingWorkspace';
import { createCompetitorPricingJob, getCompetitorPricingJob, writeCompetitorPricingToGoogleSheet } from '../services/competitorPricingApi';

vi.mock('../services/competitorPricingApi', () => ({
  createCompetitorPricingJob: vi.fn(),
  getCompetitorPricingJob: vi.fn(),
  getCompetitorPricingDownloadUrl: vi.fn((jobId: string, format: string) => `/download/${jobId}.${format}`),
  writeCompetitorPricingToGoogleSheet: vi.fn(),
}));

const csv = [
  ['fb476', 'D', 'CONTAINER ONLY', 'MFG BEST SELLER', '', 'WEB DESCR', 'SKUs                                              (How to Set Up on Floor)', 'DESCRIPTION', 'SALES PRICE (STARBURST)', 'FD5', 'FD7', 'G1', 'CAMP', 'BASE', 'REMARKS', '335 COST', 'WHSE COST', 'AHS COMP PRICE', 'FFL/ OTHER COMP PRICE', 'STAR BURST', 'STARBURST PRICE', 'STAR BURST GPM%', 'REG PRICE', 'GPM%'].join(','),
  ['Albany', 'SS', '', '', 'X', '', '8642-61', 'Groovy Navy', '$1,499', '', '', '', '', '', 'Need movement', '', '$714', 'N/A', 'FF $1,399', '', '', '', '$1,799', ''].join(','),
  ['Ashley', 'S', '', '', 'X', '', 'B076-280', 'Trentlore', 'Twin Metal DayBed $199', '', '', '', '', '', "DISCO'D", '', '$100', 'N/A', 'N/A', '', '', '', '$299', ''].join(','),
  ['Ashley', 'SS', '', '', 'REGULAR PRICE', '', 'B1050-31/36/46/54/57/96/92', 'Hyana', '7PC Q $1,399 K $1,599', '', '', '', '', '', 'Matches B200 BR', '', '$900', '$1,996', '$1,056', '', '', '', '$1,599', ''].join(','),
].join('\n');

function openRunJobTab() {
  fireEvent.click(screen.getByRole('button', { name: /Run Job/i }));
}

describe('CompetitorPricingWorkspace', () => {
  beforeEach(() => {
    vi.mocked(createCompetitorPricingJob).mockReset();
    vi.mocked(getCompetitorPricingJob).mockReset();
    vi.mocked(writeCompetitorPricingToGoogleSheet).mockReset();
  });

  it('renders upload controls and starts disabled before rows are loaded', () => {
    render(<CompetitorPricingWorkspace />);
    openRunJobTab();
    expect(screen.getByRole('heading', { name: 'Competitor Pricing' })).toBeInTheDocument();
    expect(screen.getByLabelText('Upload pricing CSV or workbook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Non-Ashley First' })).toBeDisabled();
  });

  it('parses an uploaded CSV and shows bucket counts', async () => {
    render(<CompetitorPricingWorkspace />);
    openRunJobTab();
    const file = new File([csv], 'pricing.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Upload pricing CSV or workbook'), { target: { files: [file] } });

    await screen.findByText('8642-61');
    expect(screen.getByText('Groovy Navy')).toBeInTheDocument();
    expect(screen.getByText('3 product rows extracted. Showing first 3.')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: 'Run Non-Ashley First' })).toBeEnabled();
  });

  it('posts only non-Ashley rows for the default run mode and shows download links when complete', async () => {
    vi.mocked(createCompetitorPricingJob).mockResolvedValue({
      jobId: 'job-1',
      status: 'completed',
      mode: 'non_ashley_first',
      totalRows: 1,
      processedRows: 1,
      startedAt: 'now',
      completedAt: 'later',
    });
    render(<CompetitorPricingWorkspace />);
    openRunJobTab();
    const file = new File([csv], 'pricing.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Upload pricing CSV or workbook'), { target: { files: [file] } });

    await screen.findByText('8642-61');
    fireEvent.click(screen.getByRole('button', { name: 'Run Non-Ashley First' }));

    await waitFor(() => expect(createCompetitorPricingJob).toHaveBeenCalledTimes(1));
    const call = vi.mocked(createCompetitorPricingJob).mock.calls[0][0];
    expect(call.mode).toBe('non_ashley_first');
    expect(call.rows).toHaveLength(1);
    expect(call.rows[0].vendor).toBe('Albany');
    expect(await screen.findByText(/Status: completed/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download CSV' })).toHaveAttribute('href', '/download/job-1.csv');
    expect(screen.getByRole('button', { name: 'Write to Google Sheet' })).toBeDisabled();
  });

  it('writes completed job results to the configured Google Sheet', async () => {
    vi.mocked(createCompetitorPricingJob).mockResolvedValue({
      jobId: 'job-1',
      status: 'completed',
      mode: 'non_ashley_first',
      totalRows: 1,
      processedRows: 1,
      startedAt: 'now',
      completedAt: 'later',
    });
    vi.mocked(writeCompetitorPricingToGoogleSheet).mockResolvedValue({
      spreadsheetId: 'sheet-1',
      sheetName: 'STORE MOVES AND PRICING',
      sheetId: 123,
      dryRun: false,
      updatedRows: 1,
      updatedCells: 1,
      skippedRows: [],
      columns: { ahsCompColumn: 'R', fflCompColumn: 'S', furnitureFairCompColumn: 'T' },
    });

    render(<CompetitorPricingWorkspace />);
    openRunJobTab();
    const file = new File([csv], 'pricing.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Upload pricing CSV or workbook'), { target: { files: [file] } });

    await screen.findByText('8642-61');
    fireEvent.click(screen.getByRole('button', { name: 'Run Non-Ashley First' }));
    await screen.findByText(/Status: completed/);

    fireEvent.change(screen.getByLabelText('Google Sheet URL or ID'), { target: { value: 'https://docs.google.com/spreadsheets/d/sheet-1/edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Write to Google Sheet' }));

    await waitFor(() => expect(writeCompetitorPricingToGoogleSheet).toHaveBeenCalledWith({
      jobId: 'job-1',
      spreadsheetIdOrUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
      sheetName: 'STORE MOVES AND PRICING',
    }));
    expect(await screen.findByText(/Updated 1 comp-price cells across 1 rows/)).toBeInTheDocument();
  });
});
