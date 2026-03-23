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
  --no-setup                Skip morloc installation (code-tester starts from testing)
  --no-destroy              Keep the VM running after code-tester finishes
  --skip-analyst            Skip the analyst consolidation step

Examples:
  $(basename "$0")
  $(basename "$0") --agents code-tester --no-destroy
  $(basename "$0") --agents prose-reviewer,technical-reviewer --skip-analyst
  $(basename "$0") --no-setup --no-destroy --agents code-tester
  $(basename "$0") -f "focus on the effects and optionals sections"
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

# --- Code tester (needs VM) ---
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

        mkdir -p "$FINDINGS_DIR/code-tester"

        SETUP_NOTE="Follow the getting-started.asc instructions to install morloc on the VM first."
        if [ "$SKIP_SETUP" -eq 1 ]; then
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
  Entry point: $REPO_DIR/src/index.adoc
  Content files: $REPO_DIR/src/content/

Write your summary report to: $FINDINGS_DIR/code-tester/report.md
Write bug reports to: $FINDINGS_DIR/code-tester/bug-NNN.md

$SHARED_CONTEXT${FOCUS:+

FOCUS: $FOCUS}"

        log "Running code-tester agent"
        if ! claude -p "$CODE_PROMPT" \
            --agent doc-code-tester \
            --allowedTools "Bash,Read,Write" \
            --no-session-persistence \
            --output-format text \
            < /dev/null 2>&1 | tee "$FINDINGS_DIR/code-tester/session.log"; then
            log "WARNING: code-tester agent exited with error"
            HAD_FAILURES=1
        fi
        log "Code-tester done"
    fi

    if [ "$SKIP_DESTROY" -eq 0 ]; then
        log "Destroying VM"
        vagrant destroy -f fedora
    else
        log "Keeping VM running (--no-destroy)"
    fi

    # Clean up SSH keys
    rm -rf "$FINDINGS_DIR/.ssh"
fi

# --- Prose reviewer and technical reviewer (host-only, run in parallel) ---
REVIEW_PIDS=""

if has_agent "prose-reviewer"; then
    mkdir -p "$FINDINGS_DIR/prose-reviewer"

    PROSE_PROMPT="You are reviewing the morloc documentation for writing quality.

Documentation files are on the HOST at:
  Entry point: $REPO_DIR/src/index.adoc
  Content files: $REPO_DIR/src/content/

Write your report to: $FINDINGS_DIR/prose-reviewer/report.md

$SHARED_CONTEXT${FOCUS:+

FOCUS: $FOCUS}"

    log "Running prose-reviewer agent (background)"
    claude -p "$PROSE_PROMPT" \
        --agent doc-prose-reviewer \
        --allowedTools "Read,Write" \
        --no-session-persistence \
        --output-format text \
        < /dev/null > "$FINDINGS_DIR/prose-reviewer/session.log" 2>&1 &
    REVIEW_PIDS="$REVIEW_PIDS $!"
fi

if has_agent "technical-reviewer"; then
    mkdir -p "$FINDINGS_DIR/technical-reviewer"

    TECH_PROMPT="You are reviewing the morloc documentation for technical correctness.

Documentation files are on the HOST at:
  Entry point: $REPO_DIR/src/index.adoc
  Content files: $REPO_DIR/src/content/

Write your report to: $FINDINGS_DIR/technical-reviewer/report.md

$SHARED_CONTEXT${FOCUS:+

FOCUS: $FOCUS}"

    log "Running technical-reviewer agent (background)"
    claude -p "$TECH_PROMPT" \
        --agent doc-technical-reviewer \
        --allowedTools "Read,Write" \
        --no-session-persistence \
        --output-format text \
        < /dev/null > "$FINDINGS_DIR/technical-reviewer/session.log" 2>&1 &
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
    log "Review agents done"
fi

# --- Analyst agent ---
if [ "$SKIP_ANALYST" -eq 0 ]; then
    log "Running analyst agent"
    if ! claude -p "Fold across all bug reports and documentation review reports in findings/. Initialize findings/action-plan.md, then process each report one at a time: compare it to existing entries in the action plan, either merge it into an existing entry or add a new one. The result should be a single consolidated action plan, not a per-report listing.

Reports come from three agents:
- code-tester: tested code examples (bug reports + summary)
- prose-reviewer: evaluated writing quality
- technical-reviewer: evaluated technical correctness

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
