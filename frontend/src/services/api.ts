import type {
  AirQualityApiError,
  HealthResponse,
  LocationDetail,
  LocationMeasurementsResponse,
  LocationSummary,
  ProviderStatusResponse,
} from '../types';

/**
 * Returns the configured base API URL, defaulting to local FastAPI dev server.
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export interface HealthCheckResult {
  data: HealthResponse | null;
  error: string | null;
  latencyMs: number | null;
}

/**
 * Queries the EcoSentinel FastAPI backend health check endpoint (/api/health).
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/health`;
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        latencyMs,
      };
    }

    const data: HealthResponse = await response.json();
    return {
      data,
      error: null,
      latencyMs,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return {
          data: null,
          error: `Connection timed out (backend not responding at ${baseUrl})`,
          latencyMs,
        };
      }
      return {
        data: null,
        error: `Unable to reach backend service (${err.message})`,
        latencyMs,
      };
    }

    return {
      data: null,
      error: 'Unknown error occurred while contacting backend',
      latencyMs,
    };
  }
}

async function handleApiResponse<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T | null; error: AirQualityApiError | null }> {
  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      try {
        const errorJson = await response.json();
        if (errorJson && typeof errorJson === 'object' && 'error_code' in errorJson) {
          return { data: null, error: errorJson as AirQualityApiError };
        }
      } catch {
        // Fall back to generic error
      }
      return {
        data: null,
        error: {
          error: 'HttpError',
          message: `Request failed with status HTTP ${response.status} (${response.statusText})`,
          error_code: `HTTP_${response.status}`,
          instructions: 'Check that the EcoSentinel backend is running on port 8000.',
        },
      };
    }

    const data: T = await response.json();
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        error: 'NetworkError',
        message: err instanceof Error ? err.message : 'Failed to communicate with EcoSentinel API.',
        error_code: 'NETWORK_ERROR',
        instructions: 'Verify your network connection and backend service status.',
      },
    };
  }
}

/**
 * Checks provider status and configuration (/api/air-quality/provider-status).
 */
export async function fetchProviderStatus(): Promise<{
  data: ProviderStatusResponse | null;
  error: AirQualityApiError | null;
}> {
  const baseUrl = getApiBaseUrl();
  return handleApiResponse<ProviderStatusResponse>(`${baseUrl}/api/air-quality/provider-status`);
}

/**
 * Queries Indian monitoring stations with optional search query (/api/air-quality/locations).
 */
export async function fetchLocations(
  search?: string
): Promise<{ data: LocationSummary[] | null; error: AirQualityApiError | null }> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}/api/air-quality/locations`);
  url.searchParams.set('country', 'IN');
  url.searchParams.set('limit', '100');
  if (search && search.trim().length > 0) {
    url.searchParams.set('search', search.trim());
  }
  return handleApiResponse<LocationSummary[]>(url.toString());
}

/**
 * Retrieves detailed station metadata and sensor catalog (/api/air-quality/locations/:id).
 */
export async function fetchLocationDetail(
  locationId: number
): Promise<{ data: LocationDetail | null; error: AirQualityApiError | null }> {
  const baseUrl = getApiBaseUrl();
  return handleApiResponse<LocationDetail>(`${baseUrl}/api/air-quality/locations/${locationId}`);
}

/**
 * Retrieves historical observations for a location (/api/air-quality/locations/:id/measurements).
 */
export async function fetchMeasurements(
  locationId: number,
  parameter?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ data: LocationMeasurementsResponse | null; error: AirQualityApiError | null }> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}/api/air-quality/locations/${locationId}/measurements`);
  if (parameter) {
    url.searchParams.set('parameter', parameter);
  }
  if (dateFrom) {
    url.searchParams.set('date_from', dateFrom);
  }
  if (dateTo) {
    url.searchParams.set('date_to', dateTo);
  }
  return handleApiResponse<LocationMeasurementsResponse>(url.toString());
}
