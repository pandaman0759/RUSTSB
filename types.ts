export interface PosterData {
  name: string;
  tag: string; // New field for "New", "Updated", etc.
  shortDescription: string;
  price: string;
  summary: string;
  features: string[];
  imageUrls: string[];
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  data: PosterData | null;
}

export enum ViewMode {
  INPUT = 'INPUT',
  PREVIEW = 'PREVIEW'
}