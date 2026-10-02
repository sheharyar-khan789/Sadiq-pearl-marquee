// TEST-ONLY business configurations. The numbers here are test fixtures,
// never the venue's prices; the real configuration starts unpriced.
import { DEFAULT_CONFIG, type BusinessConfig, type PricingSettings, type ServiceConfig } from "../../src/lib/config/business-config.ts";

/** DEFAULT_CONFIG with the given pricing (and optional extra changes). */
export function testConfig(pricing: Partial<PricingSettings>, over: Partial<BusinessConfig> = {}): BusinessConfig {
  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...over,
    pricing: { ...DEFAULT_CONFIG.pricing, smallEventSurcharge: null, serviceChargePercent: null, ...pricing },
  };
}

export function testService(id: string, over: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    id,
    name: id,
    description: "",
    category: "other",
    active: true,
    sortOrder: 1,
    pricingMode: "fixed",
    price: 1000,
    version: 1,
    ...over,
  };
}
