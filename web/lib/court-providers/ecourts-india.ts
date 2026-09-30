export type CourtSearchResult = {
  cnr: string;
  caseType: string;
  registrationNumber: string;
  courtCode: string;
  courtName: string;
  caseStatus: string;
  nextHearingDate: string | null;
  petitioners: string[];
  respondents: string[];
  petitionerAdvocates: string[];
  respondentAdvocates: string[];
};

type SearchResponse = {
  data?: {
    results?: CourtSearchResult[];
    totalHits?: number;
  };
};

const BASE_URL = "https://webapi.ecourtsindia.com/api/partner";

function token() {
  const value = process.env.ECOURTSINDIA_API_TOKEN?.trim();

  if (!value) {
    throw new Error("eCourtsIndia API token is not configured.");
  }

  return value;
}

export async function searchCourtCases(
  query: string,
  courtCode?: string,
): Promise<{ results: CourtSearchResult[]; totalHits: number }> {
  const url = new URL(`${BASE_URL}/search`);

  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "20");

  if (courtCode) {
    url.searchParams.append("courtCodes", courtCode);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`eCourtsIndia search failed (${response.status}).`);
  }

  const payload = (await response.json()) as SearchResponse;

  return {
    results: payload.data?.results ?? [],
    totalHits: payload.data?.totalHits ?? 0,
  };
}