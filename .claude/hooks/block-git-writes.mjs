// PreToolUse hook for Bash and PowerShell: Claude never commits or pushes in this repo
// (CLAUDE.md, Working agreements). The organizer runs every command that creates or publishes commits.
import { readFileSync } from 'node:fs';

// `git`, optional global options (-C dir, -c key=value, --no-pager…), then a subcommand that writes history;
// or a gh command that merges or pushes.
const BLOCKED =
  /\bgit(?:\s+(?:-[cC]\s+\S+|--?[\w-]+(?:=\S+)?))*\s+(?:commit|commit-tree|push|merge|rebase|cherry-pick|revert|am)(?=\s|$|[;&|)])|\bgh\s+pr\s+merge\b|\bgh\s+repo\s+sync\b|\bgh\s+repo\s+create\b[^;&|]*\s--push\b/;

let command = '';
try {
  command = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? '';
} catch {
  process.exit(0); // unreadable input: leave the decision to the normal permission flow
}

const match = command.match(BLOCKED);
if (match) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `"${match[0].trim()}" is the organizer's job: Claude never commits or pushes in this repo ` +
          '(CLAUDE.md, Working agreements). Leave the changes in the working tree and propose a commit message.',
      },
    }),
  );
}
