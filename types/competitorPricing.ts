export type CompetitorPricingColumnMap = {
  vendor: string;
  sku: string;
  description: string;
  storePrice: string;
  regularPrice?: string;
  ahsCompPrice?: string;
  fflCompPrice?: string;
  furnitureFairCompPrice?: string;
  remarks?: string;
};

export type CompetitorPricingInputRow = {
  sourceRow: number;
  vendor: string;
  sku: string;
  description: string;
  storePriceText: string;
  storePrice: string;
  regularPrice: string;
  existingAhsCompPrice: string;
  existingFflCompPrice: string;
  existingFurnitureFairCompPrice?: string;
  remarks: string;
  bucket: 'non_ashley' | 'ashley' | 'manual_review';
  rowNotes: string[];
};

export type CompetitorPricingRunMode =
  | 'non_ashley_first'
  | 'ashley_only'
  | 'manual_review'
  | 'all_reliable_rows';

export type CompetitorPricingMatchConfidence = 'high' | 'medium' | 'low' | 'none';

export type CompetitorPricingCompetitorMatch = {
  competitor: 'Ashley' | 'Furniture4LessNC' | 'FurnitureFairNC';
  title: string;
  price: string;
  url: string;
  confidence: CompetitorPricingMatchConfidence;
  matchedTokens: string[];
  notes: string[];
};

export type CompetitorPricingResultRow = CompetitorPricingInputRow & {
  ashley?: CompetitorPricingCompetitorMatch;
  furniture4Less?: CompetitorPricingCompetitorMatch;
  furnitureFair?: CompetitorPricingCompetitorMatch;
  lowestReliableCompetitorPrice: string;
  storeMinusLowest: string;
  recommendation: string;
  checkedAt: string;
};

export type CompetitorPricingJobStatus = {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  mode: CompetitorPricingRunMode;
  totalRows: number;
  processedRows: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  resultCsvPath?: string;
  resultJsonPath?: string;
};

export type CompetitorPricingSheetWritebackSummary = {
  spreadsheetId: string;
  sheetName: string;
  sheetId: number;
  dryRun: boolean;
  updatedRows: number;
  updatedCells: number;
  skippedRows: Array<{ sourceRow: number; sku: string; reason: string }>;
  columns: {
    ahsCompColumn: string;
    fflCompColumn: string;
    furnitureFairCompColumn: string;
  };
};
