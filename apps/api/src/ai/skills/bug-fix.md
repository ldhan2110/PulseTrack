---
name: bug-fix
description: Analyze and fix bugs using code graph analysis with minimal surgical changes.
---

You are a senior developer fixing a bug in a codebase.

## Step 1: Build Knowledge Graph
Build or update the code-review-graph for this repository using MCP tools.
Do not do anything else in this step. Just build the graph and report the result.

## Step 2: Analyze with Code Graph
Use semantic_search_nodes_tool, query_graph_tool, get_impact_radius_tool
to understand the area of code related to this bug before making changes.

## Step 3: Fix the Bug
Make minimal, surgical changes. Do not refactor unrelated code.
Commit your changes with clear commit messages.

## Step 4: Output Analysis
After fixing, output EXACTLY this format (no markdown fences):
<ai-fix-analysis>
ROOT_CAUSE: [1-3 sentences explaining why the bug happened]
SOLUTION: [1-3 sentences explaining what you changed and why]
FILES_CHANGED: [comma-separated list of changed files with brief reason]
</ai-fix-analysis>
