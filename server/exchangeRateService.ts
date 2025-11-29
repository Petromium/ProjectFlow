import type { InsertExchangeRate, ExchangeRate, InsertExchangeRateSync } from "@shared/schema";
import { storage } from "./storage";
import { parseString } from "xml2js";
import { promisify } from "util";

const parseStringAsync = promisify(parseString);

const ECB_API_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const ECB_NAMESPACE = "http://www.ecb.int/vocabulary/2002-08-01/eurofxref";

interface ECBRate {
  currency: string;
  rate: string;
}

interface ECBResponse {
  "gesmes:Envelope": {
    Cube: {
      Cube: {
        Cube: Array<{ $: ECBRate }>;
      }[];
    };
  };
}

/**
 * Fetch exchange rates from European Central Bank API
 * ECB provides EUR-based rates for major currencies
 */
export async function fetchECBRates(date?: Date): Promise<Map<string, number>> {
  try {
    const url = date 
      ? `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml`
      : ECB_API_URL;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ECB API returned ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Parse XML using xml2js
    const result: any = await new Promise((resolve, reject) => {
      parseString(xmlText, {
        explicitArray: true,
        mergeAttrs: true,
        xmlns: true,
      }, (err: any, parsed: any) => {
        if (err) reject(err);
        else resolve(parsed);
      });
    });
    const rates = new Map<string, number>();

    // ECB XML structure: Envelope > Cube > Cube > Cube[] (daily rates)
    const envelope = result["gesmes:Envelope"] || result.Envelope;
    const cubeWrapper = envelope?.Cube?.Cube || envelope?.Cube;
    
    // Handle both daily and historical formats
    let dailyCubes: any[] = [];
    if (Array.isArray(cubeWrapper)) {
      // Historical data: multiple Cube elements for different dates
      if (date) {
        // Find the cube for the specific date
        const dateStr = date.toISOString().split('T')[0];
        const targetCube = cubeWrapper.find((cube: any) => {
          const cubeDate = cube.$.time || cube.$?.date;
          return cubeDate === dateStr;
        });
        if (targetCube && targetCube.Cube) {
          dailyCubes = Array.isArray(targetCube.Cube) ? targetCube.Cube : [targetCube.Cube];
        }
      } else {
        // Latest rates: use the last cube
        const latestCube = cubeWrapper[cubeWrapper.length - 1];
        if (latestCube?.Cube) {
          dailyCubes = Array.isArray(latestCube.Cube) ? latestCube.Cube : [latestCube.Cube];
        }
      }
    } else if (cubeWrapper?.Cube) {
      // Daily format: single Cube with nested Cube array
      dailyCubes = Array.isArray(cubeWrapper.Cube) ? cubeWrapper.Cube : [cubeWrapper.Cube];
    }

    // Parse rate entries
    for (const cube of dailyCubes) {
      const currency = cube?.$?.currency || cube?.currency;
      const rate = cube?.$?.rate || cube?.rate;
      if (currency && rate) {
        rates.set(currency.toUpperCase(), parseFloat(rate));
      }
    }

    // Always include EUR to EUR as 1.0
    rates.set("EUR", 1.0);

    return rates;
  } catch (error) {
    console.error("[ExchangeRate] Error fetching ECB rates:", error);
    throw error;
  }
}

/**
 * Sync exchange rates from ECB
 * Fetches latest rates and stores them in database
 */
export async function syncExchangeRates(forceDate?: Date): Promise<{ success: boolean; ratesUpdated: number; error?: string }> {
  const syncDate = forceDate || new Date();
  const syncDateStr = syncDate.toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Fetch rates from ECB (EUR-based)
    const rates = await fetchECBRates(forceDate);

    let ratesUpdated = 0;
    const errors: string[] = [];

    // Store each rate in database
    for (const [targetCurrency, rate] of rates.entries()) {
      try {
        // Check if rate already exists for this date
        const existingRate = await storage.getExchangeRate(
          syncDate,
          "EUR",
          targetCurrency
        );

        if (!existingRate) {
          // Insert new rate
          await storage.createExchangeRate({
            date: syncDate,
            baseCurrency: "EUR",
            targetCurrency,
            rate: rate.toString(),
            source: "ECB",
          });
          ratesUpdated++;
        } else {
          // Update existing rate if different
          const existingRateValue = parseFloat(existingRate.rate.toString());
          if (Math.abs(existingRateValue - rate) > 0.000001) {
            await storage.updateExchangeRate(existingRate.id, {
              rate: rate.toString(),
              source: "ECB",
            });
            ratesUpdated++;
          }
        }
      } catch (error: any) {
        errors.push(`Failed to save rate for ${targetCurrency}: ${error.message}`);
      }
    }

    // Log sync operation
    const syncStatus = errors.length === 0 ? "success" : errors.length === rates.size ? "failed" : "partial";
    await storage.createExchangeRateSync({
      syncDate: syncDate,
      status: syncStatus,
      ratesUpdated,
      errorMessage: errors.length > 0 ? errors.join("; ") : undefined,
      source: "ECB",
    });

    if (errors.length > 0 && syncStatus === "failed") {
      return {
        success: false,
        ratesUpdated,
        error: errors.join("; "),
      };
    }

    return {
      success: true,
      ratesUpdated,
    };
  } catch (error: any) {
    // Log failed sync
    await storage.createExchangeRateSync({
      syncDate: syncDate,
      status: "failed",
      ratesUpdated: 0,
      errorMessage: error.message,
      source: "ECB",
    });

    return {
      success: false,
      ratesUpdated: 0,
      error: error.message,
    };
  }
}

/**
 * Get exchange rate between two currencies
 * If direct rate doesn't exist, calculate via EUR intermediary
 */
export async function getExchangeRate(
  baseCurrency: string,
  targetCurrency: string,
  date?: Date
): Promise<number | null> {
  const targetDate = date || new Date();
  const base = baseCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();

  // Same currency
  if (base === target) {
    return 1.0;
  }

  // Direct rate lookup
  const directRate = await storage.getExchangeRate(targetDate, base, target);
  if (directRate) {
    return parseFloat(directRate.rate.toString());
  }

  // Try reverse rate
  const reverseRate = await storage.getExchangeRate(targetDate, target, base);
  if (reverseRate) {
    return 1.0 / parseFloat(reverseRate.rate.toString());
  }

  // Calculate via EUR intermediary (most common since ECB uses EUR base)
  const baseToEUR = await storage.getExchangeRate(targetDate, "EUR", base);
  const targetToEUR = await storage.getExchangeRate(targetDate, "EUR", target);

  if (baseToEUR && targetToEUR) {
    // base/EUR = rate1, target/EUR = rate2
    // base/target = (base/EUR) / (target/EUR) = rate1 / rate2
    const rate1 = parseFloat(baseToEUR.rate.toString());
    const rate2 = parseFloat(targetToEUR.rate.toString());
    if (rate1 !== 0 && rate2 !== 0) {
      return rate1 / rate2;
    }
  }

  // Try reverse EUR calculation
  const EURToBase = await storage.getExchangeRate(targetDate, base, "EUR");
  const EURToTarget = await storage.getExchangeRate(targetDate, target, "EUR");

  if (EURToBase && EURToTarget) {
    // EUR/base = rate1, EUR/target = rate2
    // base/target = (EUR/target) / (EUR/base) = rate2 / rate1
    const rate1 = parseFloat(EURToBase.rate.toString());
    const rate2 = parseFloat(EURToTarget.rate.toString());
    if (rate1 !== 0 && rate2 !== 0) {
      return rate2 / rate1;
    }
  }

  return null;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<number | null> {
  const rate = await getExchangeRate(fromCurrency, toCurrency, date);
  if (rate === null) {
    return null;
  }
  return amount * rate;
}

/**
 * Get latest exchange rate (fallback to most recent available)
 */
export async function getLatestExchangeRate(
  baseCurrency: string,
  targetCurrency: string
): Promise<number | null> {
  const base = baseCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();

  if (base === target) {
    return 1.0;
  }

  // Try today, then yesterday, then last 7 days
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const rate = await getExchangeRate(base, target, date);
    if (rate !== null) {
      return rate;
    }
  }

  return null;
}

