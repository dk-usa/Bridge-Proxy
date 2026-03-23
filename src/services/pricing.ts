import { z } from 'zod';

export const ModelPricingSchema = z.object({
  modelId: z.string(),
  inputCostPerMillion: z.number(),
  outputCostPerMillion: z.number(),
});

export type ModelPricing = z.infer<typeof ModelPricingSchema>;

export interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export function calculateCost(
  usage: UsageRecord,
  pricing: ModelPricing | undefined
): { inputCost: number; outputCost: number; totalCost: number } {
  if (!pricing) {
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputCostPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputCostPerMillion;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: Math.round(inputCost * 100) / 100,
    outputCost: Math.round(outputCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
  };
}

const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'claude-3-5-sonnet-20241022': {
    modelId: 'claude-3-5-sonnet-20241022',
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
  },
  'claude-3-5-sonnet-20240620': {
    modelId: 'claude-3-5-sonnet-20240620',
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
  },
  'claude-3-opus-20240229': {
    modelId: 'claude-3-opus-20240229',
    inputCostPerMillion: 15,
    outputCostPerMillion: 75,
  },
  'claude-3-sonnet-20240229': {
    modelId: 'claude-3-sonnet-20240229',
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
  },
  'claude-3-haiku-20240307': {
    modelId: 'claude-3-haiku-20240307',
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4,
  },
  'gpt-4o': {
    modelId: 'gpt-4o',
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10,
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
  },
  'gpt-4-turbo': {
    modelId: 'gpt-4-turbo',
    inputCostPerMillion: 10,
    outputCostPerMillion: 30,
  },
  'gpt-4': {
    modelId: 'gpt-4',
    inputCostPerMillion: 30,
    outputCostPerMillion: 60,
  },
  'gpt-3.5-turbo': {
    modelId: 'gpt-3.5-turbo',
    inputCostPerMillion: 0.5,
    outputCostPerMillion: 1.5,
  },
};

class PricingService {
  private customPricing: Map<string, ModelPricing> = new Map();

  setPricing(modelId: string, pricing: ModelPricing): void {
    this.customPricing.set(modelId, pricing);
  }

  getPricing(modelId: string): ModelPricing | undefined {
    return this.customPricing.get(modelId) ?? DEFAULT_PRICING[modelId];
  }

  getAllPricing(): ModelPricing[] {
    const custom = Array.from(this.customPricing.values());
    const defaults = Object.values(DEFAULT_PRICING);
    return [...custom, ...defaults];
  }

  clearCustomPricing(): void {
    this.customPricing.clear();
  }
}

export const pricingService = new PricingService();
