import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { AiContext } from '@/lib/ai';

export const PROMPT_VERSION = 'v1';
export const MODEL = 'gemini-3.6-flash';

export const ReleaseSummary = z.object({
  headline: z.string().describe('One line, plain language, what this release is about'),
  changes: z.array(
    z.object({
      type: z.enum(['feature', 'fix', 'breaking', 'perf', 'deprecation']),
      description: z.string()
    })
  ),
  upgradeEffort: z.enum(['none', 'low', 'medium', 'high'])
});

export type ReleaseSummary = z.infer<typeof ReleaseSummary>;

export async function summarizeRelease(input: { repo: string; tag: string; body: string }, ai: AiContext) {
  const result = await generateText({
    model: ai.model,
    output: Output.object({ schema: ReleaseSummary }),
    system:
      'You summarize software release notes for working developers. ' +
      'Be concrete and specific. Never invent changes that are not in the input. ' +
      'If the notes are empty or trivial, return an empty changes array.' +
      (ai.instructions
        ? `

The reader has described what they care about. Weight the summary towards it, but never omit breaking changes:
${ai.instructions}`
        : ''),
    prompt: `Repo: ${input.repo}\nVersion: ${input.tag}\n\nRelease notes:\n${input.body}`
  });

  return { output: result.output, usage: result.usage };
}
