// PreToolUse hook for Bash and PowerShell: Claude never changes production on its own (CLAUDE.md, Working
// agreements). The organizer deploys, sets secrets and writes the production database, unless they give
// permission for that step. Unlike the "ask" rules in settings.json, which match a command by how it starts,
// this reads the whole command, so a deploy inside `cd … && npx wrangler deploy` or a pipe still asks.
import { readFileSync } from 'node:fs';

// `wrangler` (through npx or not), then a subcommand that changes what runs on afig.nl or what it stores.
// Read-only commands (whoami, deployments list, secret list, d1 list, d1 migrations list) pass.
const PRODUCTION =
  /\bwrangler(?:\.cmd)?\s+(?:deploy|delete|rollback|triggers\s+deploy|versions\s+(?:upload|deploy|secret)|secret\s+(?:put|delete|bulk)|d1\s+(?:create|delete|import|time-travel\s+restore|migrations\s+apply\b[^;&|]*--remote|execute\b[^;&|]*--remote))\b/;

let command = '';
try {
  command = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? '';
} catch {
  process.exit(0); // unreadable input: leave the decision to the normal permission flow
}

const match = command.match(PRODUCTION);
if (match) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason:
          `"${match[0].trim()}" changes production (afig.nl). The organizer deploys, sets secrets and writes the ` +
          'production database, unless they give permission for this step (CLAUDE.md, Working agreements).',
      },
    }),
  );
}
