export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
