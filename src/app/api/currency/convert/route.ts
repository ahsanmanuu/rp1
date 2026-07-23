import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Country to Currency Mapping
const COUNTRY_CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {
  IN: { code: "INR", symbol: "₹" },
  US: { code: "USD", symbol: "$" },
  GB: { code: "GBP", symbol: "£" },
  FR: { code: "EUR", symbol: "€" },
  DE: { code: "EUR", symbol: "€" },
  IT: { code: "EUR", symbol: "€" },
  ES: { code: "EUR", symbol: "€" },
  NL: { code: "EUR", symbol: "€" },
  BE: { code: "EUR", symbol: "€" },
  GR: { code: "EUR", symbol: "€" },
  PT: { code: "EUR", symbol: "€" },
  AT: { code: "EUR", symbol: "€" },
  IE: { code: "EUR", symbol: "€" },
  FI: { code: "EUR", symbol: "€" },
  CA: { code: "CAD", symbol: "CA$" },
  AU: { code: "AUD", symbol: "A$" },
  JP: { code: "JPY", symbol: "¥" },
  CN: { code: "CNY", symbol: "¥" },
};

// Default fallback currency (USD)
const DEFAULT_CURRENCY = { code: "USD", symbol: "$" };

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
    // Fetch latest rates relative to INR from public API
    const response = await fetch("https://open.er-api.com/v6/latest/INR", {
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
    console.error("[CURRENCY_CONVERTER_API] Fetch failed, using fallback static rates:", error);
  } finally {
    clearTimeout(timeoutId);
  }

  // Static fallback rates (relative to 1 INR) if the network request fails
  return {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0093,
    CAD: 0.016,
    AUD: 0.018,
    JPY: 1.88,
    CNY: 0.086,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paramCountry = searchParams.get("country");
  const headerCountry =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country");
  const country = (paramCountry || headerCountry || "US").toUpperCase();

  try {
    const rates = await getExchangeRatesFromINR();
    const currencyInfo = COUNTRY_CURRENCY_MAP[country] || DEFAULT_CURRENCY;
    const rate = rates[currencyInfo.code] || rates["USD"] || 0.012;

    // Fetch dynamic plans from database
    const dbPlans = await prisma.membershipPlan.findMany({
      orderBy: { durationMonths: "asc" }
    });

    // Base prices dictionary (with default point recharge values in INR)
    const basePrices: Record<string, number> = {
      bronze: 5,
      silver: 15,
      gold: 50,
      premium_1m: 250,
      premium_3m: 600,
      premium_6m: 1000,
      premium_12m: 2200,
    };
    dbPlans.forEach((p: any) => {
      basePrices[p.planId] = p.priceINR;
    });

    // Calculate converted prices for simple mapping lookup
    const convertedPrices: Record<string, number> = {};
    Object.entries(basePrices).forEach(([key, inrPrice]) => {
      const converted = inrPrice * rate;
      if (currencyInfo.code === "JPY") {
        convertedPrices[key] = Math.round(converted);
      } else if (currencyInfo.code === "INR") {
        convertedPrices[key] = inrPrice;
      } else {
        convertedPrices[key] = parseFloat(converted.toFixed(2));
      }
    });

    // Formulate complete details of each plan with converted prices
    const plansList = dbPlans.map((p: any) => {
      const converted = p.priceINR * rate;
      let convertedPrice = 0;
      if (currencyInfo.code === "JPY") {
        convertedPrice = Math.round(converted);
      } else if (currencyInfo.code === "INR") {
        convertedPrice = p.priceINR;
      } else {
        convertedPrice = parseFloat(converted.toFixed(2));
      }
      return {
        planId: p.planId,
        name: p.name,
        description: p.description,
        durationMonths: p.durationMonths,
        priceINR: p.priceINR,
        convertedPrice,
        pointsExchange: p.pointsExchange
      };
    });

    return NextResponse.json({
      success: true,
      country,
      currency: currencyInfo.code,
      symbol: currencyInfo.symbol,
      rateToINR: rate,
      prices: convertedPrices,
      plans: plansList
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
