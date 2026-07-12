import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Simple in-memory cache for exchange rates (refreshed every 12 hours)
let cachedRates: Record<string, number> | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

async function getExchangeRatesFromINR(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - lastCacheTime < CACHE_DURATION) {
    return cachedRates;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    // Fetch latest rates relative to INR from public API on server side
    const response = await fetch("https://open.er-api.com/v6/latest/INR", {
      next: { revalidate: 43200 }, // Cache in Next.js fetch cache for 12 hours
      signal: controller.signal
    });
    if (!response.ok) throw new Error("Failed to fetch currency rates");
    
    const data = await response.json();
    if (data && data.rates) {
      cachedRates = data.rates;
      lastCacheTime = now;
      return data.rates;
    }
  } catch (error) {
    console.error("[CURRENCY_RATES_API] Fetch failed, using fallback static rates:", error);
  } finally {
    clearTimeout(timeoutId);
  }

  // Static fallback rates (relative to 1 INR) if the network request fails
  return {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0094,
    AED: 0.044,
    SAR: 0.045,
    SGD: 0.016,
    AUD: 0.018,
    CAD: 0.016,
    JPY: 1.93,
  };
}

export async function GET() {
  try {
    const rates = await getExchangeRatesFromINR();
    return NextResponse.json({
      success: true,
      rates
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
