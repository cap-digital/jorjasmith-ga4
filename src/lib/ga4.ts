import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

let client: BetaAnalyticsDataClient | undefined;

function readServiceAccount(): ServiceAccountKey {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_BASE64 is not set");
  }

  let key: ServiceAccountKey;
  try {
    key = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_BASE64 is not valid base64-encoded JSON");
  }

  if (!key.client_email || !key.private_key) {
    throw new Error("Service account JSON is missing client_email or private_key");
  }
  return key;
}

export function getGa4Client(): BetaAnalyticsDataClient {
  if (!client) {
    const key = readServiceAccount();
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
      },
      projectId: key.project_id,
    });
  }
  return client;
}

export function getGa4Property(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) {
    throw new Error("GA4_PROPERTY_ID is not set");
  }
  return `properties/${id}`;
}
