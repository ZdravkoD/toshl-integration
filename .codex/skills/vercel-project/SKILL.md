---
name: vercel-project
description: Use when working on this repository's Vercel deployment, project settings, domains, logs, or deploy status. Applies to the Vercel project linked to this repository, with the web app deployed from the `webapp` rootDirectory.
---

# Vercel Project

Use this skill when the user asks about the Vercel deployment, recent deploys, domains, project linkage, logs, or environment/config for this repository.

## Project facts

- Framework: `nextjs`
- Local Vercel link file: `.vercel/project.json`
- Repo-level Vercel config: `vercel.json`
- App source root: `webapp`

## Primary workflow

1. Use the Vercel MCP tools, not guesses.
2. Start with `mcp__vercel__get_project` or `mcp__vercel__list_deployments`.
3. If the user asks whether Git auto-deploy is configured, inspect deployment metadata for `githubCommitRef`, `githubRepo`, and `githubDeployment`.
4. If a deploy failed, fetch build logs with `mcp__vercel__get_deployment_build_logs`.
5. If a runtime bug is suspected, inspect runtime logs with `mcp__vercel__get_runtime_logs`.

## Useful checks

- Latest deploy status: `mcp__vercel__list_deployments`
- Project settings snapshot: `mcp__vercel__get_project`
- Build failure details: `mcp__vercel__get_deployment_build_logs`
- Runtime issues: `mcp__vercel__get_runtime_logs`
- Toolbar comments/feedback: `mcp__vercel__list_toolbar_threads`

## Repo-specific notes

- Vercel builds from `webapp` via `vercel.json` `rootDirectory`.
- The local checkout is linked to the Vercel project through `.vercel/project.json`.
- When discussing recent deploys, include commit SHA and branch if available from deployment metadata.
- When the user asks about "is Vercel connected to GitHub", verify from deployment metadata rather than inferring from the local link file alone.
