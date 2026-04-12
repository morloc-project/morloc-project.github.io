#!/bin/sh
# Documentation testing orchestrator
#
# Runs 3 agents against the morloc documentation:
#   1. code-tester: assembles and runs code examples on a VM (sequential, needs VM)
#   2. prose-reviewer: evaluates writing quality (host-only, parallel with #3)
#   3. technical-reviewer: evaluates technical correctness (host-only, parallel with #2)
# Then an analyst agent consolidates all findings.
#
# Prerequisites:
#   - vagrant + vagrant-libvirt plugin (for code-tester)
#   - claude CLI (Claude Code)
#   - Vagrantfile in the repo root

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# The docs site repo is one level above doc-agents/
DOCS_SITE_DIR="$(cd "$REPO_DIR/.." && pwd)"

ALL_AGENTS="code-tester prose-reviewer technical-reviewer"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Run autonomous agent-based documentation testing of morloc docs.

Options:
  -h, --help                Show this help message
  --info                    List available agents
  -f, --focus TEXT          Additional focus instructions for agents
  --agents LIST             Comma-separated list of agents to run (default: all)
  --passes N                Number of passes per agent type (default: 1)
  --no-setup                Skip morloc installation (code-tester starts from testing)
  --no-destroy              Keep the VM running after code-tester finishes
  --skip-analyst            Skip the analyst consolidation step

Examples:
  $(basename "$0")
  $(basename "$0") --agents code-tester --no-destroy
  $(basename "$0") --agents prose-reviewer,technical-reviewer --skip-analyst
  $(basename "$0") --no-setup --no-destroy --agents code-tester
  $(basename "$0") -f "focus on the effects and optionals sections"
  $(basename "$0") --passes 3 --agents code-tester --no-destroy
EOF
}

show_info() {
    echo "Available agents:"
    printf "  %-20s %s\n" "code-tester" "Assembles and runs code examples on VM"
    printf "  %-20s %s\n" "prose-reviewer" "Reviews writing quality (no VM needed)"
    printf "  %-20s %s\n" "technical-reviewer" "Reviews technical correctness (no VM needed)"
}

FOCUS=""
AGENTS=""
PASSES=1
SKIP_SETUP=0
SKIP_DESTROY=0
SKIP_ANALYST=0

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --info)
            show_info
            exit 0
            ;;
        -f|--focus)
            FOCUS="$2"
            shift 2
            ;;
        --agents)
            AGENTS=$(echo "$2" | tr ',' ' ')
            shift 2
            ;;
        --passes)
            PASSES="$2"
            shift 2
            ;;
        --no-setup)
            SKIP_SETUP=1
            shift
            ;;
        --no-destroy)
            SKIP_DESTROY=1
            shift
            ;;
        --skip-analyst)
            SKIP_ANALYST=1
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

AGENTS="${AGENTS:-$ALL_AGENTS}"
FINDINGS_DIR="findings"

cd "$REPO_DIR"

mkdir -p "$FINDINGS_DIR"

# Read shared context
SHARED_CONTEXT=""
if [ -f "$SCRIPT_DIR/context.md" ]; then
    SHARED_CONTEXT=$(cat "$SCRIPT_DIR/context.md")
fi
ANALYST_CONTEXT=""
if [ -f "$SCRIPT_DIR/analyst-context.md" ]; then
    ANALYST_CONTEXT=$(cat "$SCRIPT_DIR/analyst-context.md")
fi

log() {
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') $* ==="
}

# Check if a specific agent is in the run list
has_agent() {
    echo "$AGENTS" | grep -qw "$1"
}

# Load known-issues content for prompt injection
load_known_issues() {
    KNOWN_ISSUES=""
    if [ -f "$FINDINGS_DIR/known-issues.md" ]; then
        KNOWN_ISSUES=$(cat "$FINDINGS_DIR/known-issues.md")
    fi
}

# Update known-issues.md after an agent run (lightweight summarizer)
generate_known_issues() {
    _agent_dir="$1"
    _agent_name="$2"
    _pass_num="$3"

    log "Updating known-issues.md from $_agent_dir"
    claude -p "Read all reports and bug files in $_agent_dir/ and the current $FINDINGS_DIR/known-issues.md (if it exists; if not, create it).

For each NEW issue found by this agent that is not already listed:
- Add a one-line entry under the appropriate section:
  - 'Known Morloc Bugs (work around these)' for compiler/runtime bugs — include a workaround if one was found (prefix KB-N)
  - 'Known Documentation Issues (do not re-report)' for doc issues (prefix KD-N)
- Do NOT duplicate entries already present — check carefully before adding
- Number entries sequentially from the highest existing number

Update the Coverage Heatmap table:
- For each documentation section this agent examined, increment its pass count by 1
- Record '$_agent_name pass $_pass_num' in the 'Last covered by' column (append to existing entries)
- If a section is not in the table yet, add it with count 1
- Documentation sections are .asc files in src/content/

Use this format for the file:

\`\`\`
# Known Issues

## Known Morloc Bugs (work around these)
- KB-1: <description> — <workaround>

## Known Documentation Issues (do not re-report)
- KD-1: <description>

## Coverage Heatmap
| Section | Passes | Last covered by |
|---------|--------|-----------------|
| getting-started.asc | 1 | code-tester pass 1 |
\`\`\`

Write the result to $FINDINGS_DIR/known-issues.md." \
        --allowedTools "Read,Write,Glob" \
        --no-session-persistence \
        --output-format text \
        --max-turns 10 \
        < /dev/null > "$FINDINGS_DIR/known-issues-update.log" 2>&1 || \
        log "WARNING: known-issues update failed (non-fatal)"
}

# Extract SSH connection details from vagrant
extract_ssh_config() {
    _ssh_dir="$FINDINGS_DIR/.ssh"
    mkdir -p "$_ssh_dir"

    _ssh_config=$(vagrant ssh-config fedora)

    SSH_HOST=$(echo "$_ssh_config" | awk '/HostName/ {print $2}')
    SSH_PORT=$(echo "$_ssh_config" | awk '/Port/ {print $2}')
    SSH_USER=$(echo "$_ssh_config" | awk '/User / {print $2}')
    _key_path=$(echo "$_ssh_config" | awk '/IdentityFile/ {print $2}')

    SSH_KEY="$_ssh_dir/fedora_key"
    cp "$_key_path" "$SSH_KEY"
    chmod 600 "$SSH_KEY"
}

build_ssh_cmd() {
    echo "ssh -i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR $SSH_USER@$SSH_HOST"
}

# Track whether any agent failed
HAD_FAILURES=0

# Determine output directory name for an agent + pass number
# Single-pass (PASSES=1): use plain name (e.g., code-tester/)
# Multi-pass (PASSES>1): use numbered name (e.g., code-tester-1/)
agent_dir() {
    _agent="$1"
    _pass="$2"
    if [ "$PASSES" -gt 1 ]; then
        echo "$FINDINGS_DIR/${_agent}-${_pass}"
    else
        echo "$FINDINGS_DIR/$_agent"
    fi
}

# --- VM setup (once, before all passes) ---
VM_READY=0
if has_agent "code-tester"; then
    log "Starting VM for code-tester"
    if ! vagrant up fedora; then
        log "FAIL: vagrant up failed"
        HAD_FAILURES=1
    elif ! vagrant ssh fedora -c "echo 'VM ready'" 2>/dev/null; then
        log "FAIL: VM not reachable"
        HAD_FAILURES=1
    else
        extract_ssh_config
        SSH_CMD=$(build_ssh_cmd)
        log "SSH config: $SSH_USER@$SSH_HOST:$SSH_PORT"
        VM_READY=1
    fi
fi

# --- Multi-pass loop ---
_pass=0
while [ "$_pass" -lt "$PASSES" ]; do
    _pass=$((_pass + 1))
    log "=== Pass $_pass/$PASSES ==="

    # Load accumulated known-issues for prompt injection
    load_known_issues
    KNOWN_ISSUES_BLOCK=""
    if [ -n "$KNOWN_ISSUES" ]; then
        KNOWN_ISSUES_BLOCK="
KNOWN ISSUES — do not re-report these. Focus on NEW findings.
Sections with low coverage counts in the heatmap are under-explored — consider prioritizing them.
$KNOWN_ISSUES"
    fi

    # --- Code tester (needs VM) ---
    if has_agent "code-tester" && [ "$VM_READY" -eq 1 ]; then
        _ct_dir=$(agent_dir "code-tester" "$_pass")
        mkdir -p "$_ct_dir"

        SETUP_NOTE="Follow the getting-started.asc instructions to install morloc on the VM first."
        if [ "$SKIP_SETUP" -eq 1 ] || [ "$_pass" -gt 1 ]; then
            SETUP_NOTE="Morloc is already installed. Skip getting-started setup and go straight to testing code examples."
        fi

        CODE_PROMPT="You are testing all code examples in the morloc documentation.

SSH into the VM with: $SSH_CMD \"<your command>\"
Run morloc commands as: $SSH_CMD \"morloc-manager run morloc make foo.loc\"
Run executables as: $SSH_CMD \"morloc-manager run ./foo subcommand args\"
Install modules as: $SSH_CMD \"morloc-manager run morloc install stdlib\"

Work in ~/test/ on the VM. Create subdirectories per section.

$SETUP_NOTE

Documentation files are on the HOST at:
  Entry point: $DOCS_SITE_DIR/src/index.adoc
  Content files: $DOCS_SITE_DIR/src/content/

Write your summary report to: $_ct_dir/report.md
Write bug reports to: $_ct_dir/bug-NNN.md

$SHARED_CONTEXT${FOCUS:+

FOCUS: $FOCUS}$KNOWN_ISSUES_BLOCK"

        log "Running code-tester agent (pass $_pass)"
        if ! claude -p "$CODE_PROMPT" \
            --agent doc-code-tester \
            --allowedTools "Bash,Read,Write" \
            --no-session-persistence \
            --output-format text \
            < /dev/null 2>&1 | tee "$_ct_dir/session.log"; then
            log "WARNING: code-tester agent exited with error"
            HAD_FAILURES=1
        fi
        log "Code-tester pass $_pass done"

        generate_known_issues "$_ct_dir" "code-tester" "$_pass"
    fi

    # --- Prose reviewer and technical reviewer (host-only, run in parallel) ---
    # Reload known-issues (may have been updated by code-tester above)
    load_known_issues
    KNOWN_ISSUES_BLOCK=""
    if [ -n "$KNOWN_ISSUES" ]; then
        KNOWN_ISSUES_BLOCK="
KNOWN ISSUES — do not re-report these. Focus on NEW findings.
Sections with low coverage counts in the heatmap are under-explored — consider prioritizing them.
$KNOWN_ISSUES"
    fi

    REVIEW_PIDS=""

    if has_agent "prose-reviewer"; then
        _pr_dir=$(agent_dir "prose-reviewer" "$_pass")
        mkdir -p "$_pr_dir"

        PROSE_PROMPT="You are reviewing the morloc documentation for writing quality.

Documentation files are on the HOST at:
  Entry point: $DOCS_SITE_DIR/src/index.adoc
  Content files: $DOCS_SITE_DIR/src/content/

Write your report to: $_pr_dir/report.md

$SHARED_CONTEXT${FOCUS:+

FOCUS: $FOCUS}$KNOWN_ISSUES_BLOCK"

        log "Running prose-reviewer agent (pass $_pass, background)"
        claude -p "$PROSE_PROMPT" \
            --agent doc-prose-reviewer \
            --allowedTools "Read,Write" \
            --no-session-persistence \
            --output-format text \
            < /dev/null > "$_pr_dir/session.log" 2>&1 &
        REVIEW_PIDS="$REVIEW_PIDS $!"
    fi

    if has_agent "technical-reviewer"; then
        _tr_dir=$(agent_dir "technical-reviewer" "$_pass")
        mkdir -p "$_tr_dir"

        TECH_PROMPT="You are reviewing the morloc documentation for technical correctness.

Documentation files are on the HOST at:
  Entry point: $DOCS_SITE_DIR/src/index.adoc
  Content files: $DOCS_SITE_DIR/src/content/

Write your report to: $_tr_dir/report.md

$SHARED_CONTEXT${FOCUS:+

FOCUS: $FOCUS}$KNOWN_ISSUES_BLOCK"

        log "Running technical-reviewer agent (pass $_pass, background)"
        claude -p "$TECH_PROMPT" \
            --agent doc-technical-reviewer \
            --allowedTools "Read,Write" \
            --no-session-persistence \
            --output-format text \
            < /dev/null > "$_tr_dir/session.log" 2>&1 &
        REVIEW_PIDS="$REVIEW_PIDS $!"
    fi

    # Wait for reviewers to finish
    if [ -n "$REVIEW_PIDS" ]; then
        log "Waiting for review agents to finish..."
        for pid in $REVIEW_PIDS; do
            if ! wait "$pid"; then
                log "WARNING: a review agent exited with error (pid $pid)"
                HAD_FAILURES=1
            fi
        done
        log "Review agents pass $_pass done"
    fi

    # Update known-issues from reviewer outputs
    if has_agent "prose-reviewer"; then
        _pr_dir=$(agent_dir "prose-reviewer" "$_pass")
        generate_known_issues "$_pr_dir" "prose-reviewer" "$_pass"
    fi
    if has_agent "technical-reviewer"; then
        _tr_dir=$(agent_dir "technical-reviewer" "$_pass")
        generate_known_issues "$_tr_dir" "technical-reviewer" "$_pass"
    fi
done

# --- VM cleanup (after all passes) ---
if has_agent "code-tester"; then
    if [ "$SKIP_DESTROY" -eq 0 ]; then
        log "Destroying VM"
        vagrant destroy -f fedora
    else
        log "Keeping VM running (--no-destroy)"
    fi
    # Clean up SSH keys
    rm -rf "$FINDINGS_DIR/.ssh"
fi

# --- Analyst agent ---
if [ "$SKIP_ANALYST" -eq 0 ]; then
    # Load final known-issues for analyst context
    KNOWN_ISSUES_HINT=""
    if [ -f "$FINDINGS_DIR/known-issues.md" ]; then
        KNOWN_ISSUES_HINT="

Start by reading findings/known-issues.md for a high-level map of all known issues before processing individual reports."
    fi

    log "Running analyst agent"
    if ! claude -p "Fold across all bug reports and documentation review reports in findings/. Initialize findings/action-plan.md, then process each report one at a time: compare it to existing entries in the action plan, either merge it into an existing entry or add a new one. The result should be a single consolidated action plan, not a per-report listing.

Reports come from three agents (possibly multiple passes each):
- code-tester: tested code examples (bug reports + summary)
- prose-reviewer: evaluated writing quality
- technical-reviewer: evaluated technical correctness
$KNOWN_ISSUES_HINT
$ANALYST_CONTEXT" \
        --agent doc-analyst \
        --allowedTools "Read,Write,Glob,Grep" \
        --no-session-persistence \
        --output-format text \
        < /dev/null 2>&1 | tee "$FINDINGS_DIR/analyst-session.log"; then
        log "WARNING: analyst agent exited with error"
        HAD_FAILURES=1
    fi
fi

log "Exploration complete. Results in $FINDINGS_DIR/"
if [ -f "$FINDINGS_DIR/action-plan.md" ]; then
    log "Action plan: $FINDINGS_DIR/action-plan.md"
fi

if [ "$HAD_FAILURES" -eq 1 ]; then
    log "WARNING: one or more agents had errors — check session logs"
    exit 1
fi
