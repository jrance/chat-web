// Simple stubbed registry of model providers and models.
// In the future, replace fetchProviders/fetchModels with API calls.

export type ProviderId = "openai" | "azureopenai" | "gemini" | string;

export const AVAILABLE_PROVIDERS: ProviderId[] = ["openai", "azureopenai", "gemini"];

// Curated list of currently available Gemini models (stubbed)
// Keep this list in sync with Google’s public catalog when you wire an API.
const GEMINI_MODELS: string[] = [
  // 1.5 Pro
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
  // 1.5 Flash
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  // 1.5 Flash 8B (lighter)
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash-8b-latest",
  // 1.0 Pro family (legacy but still commonly listed)
  "gemini-1.0-pro",
  "gemini-1.0-pro-latest",
  // Vision-capable
  "gemini-1.0-pro-vision",
  "gemini-1.0-pro-vision-latest",
];

export async function fetchProviders(): Promise<ProviderId[]> {
  // TODO: Replace with API call. For now, return static list including Gemini.
  return AVAILABLE_PROVIDERS;
}

export async function fetchModels(provider: ProviderId): Promise<string[]> {
  // TODO: Replace with API call based on provider.
  const id = String(provider).toLowerCase();
  if (id === "gemini") return GEMINI_MODELS;
  if (id === "openai") {
    // Common OpenAI chat/completions models (stubbed)
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
    ];
  }
  if (id === "azureopenai") {
    // Azure OpenAI models (names mirror OpenAI catalog; deployments differ per tenant)
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4-turbo",
      "gpt-35-turbo",
    ];
  }
  return [];
}
