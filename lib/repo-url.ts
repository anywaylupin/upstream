import { z } from "zod";

const GITHUB_REPO_URL =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

export const RepoUrlInput = z
  .string()
  .trim()
  .min(1, "Enter a GitHub repo URL")
  .transform((value, ctx) => {
    const match = GITHUB_REPO_URL.exec(value);
    const owner = match?.[1];
    const name = match?.[2];
    if (!owner || !name) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a GitHub repo URL like https://github.com/owner/name",
      });
      return z.NEVER;
    }
    return { owner, name };
  });
