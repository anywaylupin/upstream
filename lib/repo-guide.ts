import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { MODEL } from "@/lib/summarize";

/** Bumped when the schema or prompt changes, so stored guides can be spotted as stale. */
export const GUIDE_PROMPT_VERSION = "v2";

/** README text sent to the model. Enough to work with, bounded for cost. */
const README_LIMIT = 12_000;

export const RepoGuide = z.object({
  whatItIs: z
    .string()
    .describe("One sentence: what this project does. No marketing language"),
  bestFor: z
    .array(z.string())
    .describe(
      "Three to five short keyword tags for what this is good at, 1-3 words each, lowercase",
    ),
  install: z
    .string()
    .describe(
      "The install command, e.g. 'npm install foo'. Empty string if not installable",
    ),
  quickStart: z
    .string()
    .describe(
      "A minimal code snippet showing the most common usage. Raw code only, no markdown fences",
    ),
  keyConcepts: z
    .array(z.object({ name: z.string(), description: z.string() }))
    .describe(
      "Three to five core concepts. Name is 1-3 words, description is one short sentence",
    ),
  gotchas: z
    .array(z.string())
    .describe("Common mistakes or surprises, at most three, one line each"),
  scores: z
    .object({
      docs: z
        .number()
        .describe("1-10, how complete and usable the documentation is"),
      ease: z
        .number()
        .describe("1-10, how easy this is to pick up. 10 means trivial"),
      apiStability: z
        .number()
        .describe(
          "1-10, how settled the public API looks. 10 means very stable",
        ),
    })
    .describe(
      "Judged only from the README. Be honest, avoid clustering at 7-8",
    ),
  verdict: z
    .string()
    .describe("One line, under 15 words: the honest take on this project"),
  alternatives: z
    .array(
      z.object({
        repo: z
          .string()
          .describe("GitHub repo as owner/name, e.g. 'tanstack/query'"),
        tradeoff: z
          .string()
          .describe("Under 12 words: how it differs from this project"),
      }),
    )
    .describe("Two to four real, well-known alternatives. Never invent repos"),
});

export type RepoGuide = z.infer<typeof RepoGuide>;

export async function generateRepoGuide(input: {
  repo: string;
  description: string | null;
  readme: string;
}) {
  const result = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: RepoGuide }),
    system:
      "You explain and rate open source projects for working developers. " +
      "Be terse and concrete - prefer keywords over sentences. " +
      "Only state what the README supports: never invent APIs, options, or commands. " +
      "For alternatives, only name repos you are confident actually exist.",
    prompt: [
      `Repo: ${input.repo}`,
      input.description ? `Description: ${input.description}` : "",
      "",
      "README:",
      input.readme.slice(0, README_LIMIT),
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return { output: result.output, usage: result.usage };
}
