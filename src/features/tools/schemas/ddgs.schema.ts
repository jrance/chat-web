import { z } from "zod";

export const ddgsParamsSchema = z.object({
  query: z.string().default(""),
  vertical: z.enum(["web", "news", "wikipedia"]).default("web"),
  maxResults: z.number().int().min(1).max(50).default(5),
  safesearch: z.enum(["off", "moderate", "strict"]).default("moderate"),
  region: z.enum(["us-en", "uk-en", "wt-wt", "de-de", "fr-fr", "es-es", "it-it", "nl-nl", "in-en", "jp-jp"]).default("us-en"),
  timeLimit: z.enum(["", "d", "w", "m", "y"]).default(""),
  siteFilter: z.array(z.string()).default([]),
  mustInclude: z.array(z.string()).default([]),
});

export type DdgsParams = z.infer<typeof ddgsParamsSchema>;

