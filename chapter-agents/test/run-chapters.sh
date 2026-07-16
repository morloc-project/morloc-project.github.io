#!/bin/sh
# Chapter-walking orchestrator
#
# Walks morloc docs one .asc file at a time in index.adoc order. A single
# user-chosen persona reads each chapter, executes code examples on a VM,
# cross-checks the compiler when needed, and writes both a report and a
# condensed knowledge summary. Prior summaries fold into each subsequent
# agent's context.
#
# Prerequisites:
#   - vagrant + vagrant-libvirt plugin
#   - claude CLI (Claude Code)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_SITE_DIR="$(cd "$REPO_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$DOCS_SITE_DIR/../../.." && pwd)"
COMPILER_DIR="$WORKSPACE_DIR/compiler/morloc"

INDEX_ADOC="$DOCS_SITE_DIR/src/index.adoc"
CONTENT_DIR="$DOCS_SITE_DIR/src/content"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Walk the morloc documentation chapter by chapter with one chosen persona.

Options:
  -h, --help                Show this help message
  --info                    List available personas and chapters (in index order)
  -p, --persona NAME        Required. Persona file basename in test/personas/
  -f, --focus TEXT          Optional. User's focus, injected into every prompt
  --chapters LIST           Comma-separated subset (basenames, no .asc); default = all
  --start-at CHAPTER        Resume from this chapter (skip earlier ones)
  --no-vm                   Skip vagrant up (assume VM is already running)
  --no-destroy              Keep the VM after the run
  --skip-analyst            Skip the final analyst consolidation
  --no-setup                Skip morloc install; assume already installed on VM

Examples:
  $(basename "$0") --info
  $(basename "$0") -p skeptical-tester
  $(basename "$0") -p spec-lawyer --chapters getting-started,features-functions --no-destroy
  $(basename "$0") -p curious-newbie --start-at features-effects --no-setup
  $(basename "$0") -p skeptical-tester -f "pay special attention to effect syntax"
EOF
}

# --- chapter list extraction ---
# Parse index.adoc: emit basenames (without .asc) of include::{includedir}/*.asc[]
# lines in file order. AsciiDoc comment lines (// include::...) are excluded
# automatically because they don't start with 'include::'.
list_chapters() {
    sed -n 's|^include::{includedir}/\([a-z0-9-]\{1,\}\)\.asc\[\].*|\1|p' "$INDEX_ADOC"
}

list_personas() {
    (cd "$SCRIPT_DIR/personas" && ls *.md 2>/dev/null | sed 's/\.md$//')
}

show_info() {
    echo "Available personas:"
    for p in $(list_personas); do
        _desc=""
        _file="$SCRIPT_DIR/personas/$p.md"
        if [ -f "$_file" ]; then
            _desc=$(head -1 "$_file")
        fi
        if [ -n "$_desc" ]; then
            printf "  %-20s %s\n" "$p" "$_desc"
        else
            printf "  %s\n" "$p"
        fi
    done
    echo
    echo "Chapters (in index.adoc order):"
    _n=0
    for c in $(list_chapters); do
        _n=$((_n + 1))
        printf "  %2d. %s\n" "$_n" "$c"
    done
}

# --- arg parsing ---
PERSONA=""
FOCUS=""
CHAPTERS_ARG=""
START_AT=""
SKIP_VM=0
SKIP_DESTROY=0
SKIP_ANALYST=0
SKIP_SETUP=0

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --info) show_info; exit 0 ;;
        -p|--persona) PERSONA="$2"; shift 2 ;;
        -f|--focus) FOCUS="$2"; shift 2 ;;
        --chapters) CHAPTERS_ARG=$(echo "$2" | tr ',' ' '); shift 2 ;;
        --start-at) START_AT="$2"; shift 2 ;;
        --no-vm) SKIP_VM=1; shift ;;
        --no-destroy) SKIP_DESTROY=1; shift ;;
        --skip-analyst) SKIP_ANALYST=1; shift ;;
        --no-setup) SKIP_SETUP=1; shift ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    esac
done

if [ -z "$PERSONA" ]; then
    echo "ERROR: --persona is required" >&2
    echo >&2
    echo "Available personas:" >&2
    for p in $(list_personas); do echo "  $p" >&2; done
    exit 1
fi

PERSONA_FILE="$SCRIPT_DIR/personas/$PERSONA.md"
if [ ! -f "$PERSONA_FILE" ]; then
    echo "ERROR: persona file not found: $PERSONA_FILE" >&2
    echo "Available: $(list_personas | tr '\n' ' ')" >&2
    exit 1
fi

cd "$REPO_DIR"

FINDINGS_DIR="findings"
REPORTS_DIR="$FINDINGS_DIR/reports"
SUMMARIES_DIR="$FINDINGS_DIR/summaries"
mkdir -p "$REPORTS_DIR" "$SUMMARIES_DIR"

log() {
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') $* ==="
}

# --- build the ordered chapter list to actually run ---
ALL_CHAPTERS=$(list_chapters)
if [ -z "$ALL_CHAPTERS" ]; then
    echo "ERROR: no chapters found in $INDEX_ADOC" >&2
    exit 1
fi

# Apply --chapters filter (preserve index order)
if [ -n "$CHAPTERS_ARG" ]; then
    _filtered=""
    for c in $ALL_CHAPTERS; do
        for req in $CHAPTERS_ARG; do
            if [ "$c" = "$req" ]; then
                _filtered="$_filtered $c"
                break
            fi
        done
    done
    ALL_CHAPTERS=$(echo "$_filtered" | tr ' ' '\n' | sed '/^$/d')
fi

# Apply --start-at
if [ -n "$START_AT" ]; then
    _found=0
    _kept=""
    for c in $ALL_CHAPTERS; do
        if [ "$_found" -eq 1 ] || [ "$c" = "$START_AT" ]; then
            _found=1
            _kept="$_kept $c"
        fi
    done
    if [ "$_found" -eq 0 ]; then
        echo "ERROR: --start-at chapter '$START_AT' not found in the chapter list" >&2
        exit 1
    fi
    ALL_CHAPTERS=$(echo "$_kept" | tr ' ' '\n' | sed '/^$/d')
fi

TOTAL=$(echo "$ALL_CHAPTERS" | wc -l | tr -d ' ')
log "Persona: $PERSONA"
log "Chapters to run: $TOTAL"

# --- shared context load ---
CHAPTER_CONTEXT=""
if [ -f "$SCRIPT_DIR/chapter-context.md" ]; then
    CHAPTER_CONTEXT=$(cat "$SCRIPT_DIR/chapter-context.md")
fi
ANALYST_CONTEXT=""
if [ -f "$SCRIPT_DIR/analyst-context.md" ]; then
    ANALYST_CONTEXT=$(cat "$SCRIPT_DIR/analyst-context.md")
fi
PERSONA_TEXT=$(cat "$PERSONA_FILE")

# --- VM plumbing (lifted from doc-agents/test/run-exploration.sh) ---
extract_ssh_config() {
    _ssh_dir="$FINDINGS_DIR/.ssh"
    mkdir -p "$_ssh_dir"
    _ssh_config=$(cd "$SCRIPT_DIR" && vagrant ssh-config fedora)
    SSH_HOST=$(echo "$_ssh_config" | awk '/HostName/ {print $2}')
    SSH_PORT=$(echo "$_ssh_config" | awk '/Port/ {print $2}')
    SSH_USER=$(echo "$_ssh_config" | awk '/User / {print $2}')
    _key_path=$(echo "$_ssh_config" | awk '/IdentityFile/ {print $2; exit}')
    SSH_KEY="$_ssh_dir/fedora_key"
    cp "$_key_path" "$SSH_KEY"
    chmod 600 "$SSH_KEY"
}

build_ssh_cmd() {
    echo "ssh -i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR $SSH_USER@$SSH_HOST"
}

HAD_FAILURES=0

# The Vagrantfile lives beside this script, so run vagrant from $SCRIPT_DIR
if [ "$SKIP_VM" -eq 0 ]; then
    log "Starting VM (vagrant up fedora)"
    if ! (cd "$SCRIPT_DIR" && vagrant up fedora); then
        log "FAIL: vagrant up failed"
        exit 1
    fi
    if ! (cd "$SCRIPT_DIR" && vagrant ssh fedora -c "echo 'VM ready'" 2>/dev/null); then
        log "FAIL: VM not reachable"
        exit 1
    fi
fi

extract_ssh_config
SSH_CMD=$(build_ssh_cmd)
log "SSH: $SSH_USER@$SSH_HOST:$SSH_PORT"

# --- prior-summaries fold-in ---
# Concatenate all existing summaries in index order.
build_prior_summaries() {
    _out=""
    for _c in $(list_chapters); do
        _f="$SUMMARIES_DIR/$_c.md"
        if [ -f "$_f" ]; then
            _out="${_out}
--- BEGIN SUMMARY: $_c.asc ---
$(cat "$_f")
--- END SUMMARY: $_c.asc ---
"
        fi
    done
    printf '%s' "$_out"
}

# --- main loop ---
_n=0
for CHAPTER in $ALL_CHAPTERS; do
    _n=$((_n + 1))
    log "Chapter $_n/$TOTAL: $CHAPTER"

    CHAPTER_FILE="$CONTENT_DIR/$CHAPTER.asc"
    if [ ! -f "$CHAPTER_FILE" ]; then
        log "WARNING: chapter file missing: $CHAPTER_FILE (skipping)"
        continue
    fi

    PRIOR_SUMMARIES=$(build_prior_summaries)
    if [ -z "$PRIOR_SUMMARIES" ]; then
        PRIOR_BLOCK="(none — this is the first chapter or no prior summaries exist yet)"
    else
        PRIOR_BLOCK="$PRIOR_SUMMARIES"
    fi

    SETUP_NOTE="Morloc may need to be installed. If this is your first chapter and getting-started is not one of your prior summaries, follow the getting-started.asc install steps on the VM before doing anything else."
    if [ "$SKIP_SETUP" -eq 1 ]; then
        SETUP_NOTE="Morloc is already installed on the VM. Skip any install steps and go straight to running examples."
    fi

    FOCUS_BLOCK=""
    if [ -n "$FOCUS" ]; then
        FOCUS_BLOCK="

=== YOUR FOCUS (from the user) ===
$FOCUS"
    fi

    PROMPT="You are walking the morloc documentation, chapter by chapter, as this persona:

=== PERSONA ===
$PERSONA_TEXT
$FOCUS_BLOCK

=== CURRENT CHAPTER ===
File (read from the HOST): $CHAPTER_FILE
This is chapter $_n of $TOTAL in index.adoc order.
Chapter basename: $CHAPTER

=== PRIOR SUMMARIES (accumulated morloc knowledge so far, from earlier chapters in this run) ===
$PRIOR_BLOCK

=== COMPILER REFERENCE (read-only) ===
The morloc compiler source is at:
  $COMPILER_DIR
Sub-areas worth grepping:
  - executable/         CLI entry points
  - library/Morloc/     frontend, typecheck, codegen
  - spec/               test suite (ground truth for syntax + behavior)
When a doc claim is surprising, silent, or contradicted by execution, grep
here before deciding it is a bug. Cite file paths and short excerpts.
Do NOT modify anything under $COMPILER_DIR.

=== VM ACCESS ===
SSH: $SSH_CMD \"<your command>\"
Morloc commands: $SSH_CMD \"cd ~/test/$CHAPTER && morloc-manager run morloc <args>\"
Install modules: $SSH_CMD \"morloc-manager run morloc install <module>\"
Work in: ~/test/$CHAPTER/ on the VM (create it).

$SETUP_NOTE

=== SHARED CONTEXT ===
$CHAPTER_CONTEXT

=== YOUR TASK ===
1. Read $CHAPTER_FILE end to end.
2. Execute every code example. Complete partial code with the smallest
   reasonable additions; note additions in the report.
3. Log findings per the persona's priorities:
   - Code that fails to compile or run.
   - Text that is ambiguous or contradictory.
   - Claims that disagree with what the compiler actually does.
   - Missing information a reader would need to reproduce the example.
4. Cross-check the compiler source when in doubt before filing something.

=== OUTPUTS (BOTH required; use the Write tool) ===
1. $REPORTS_DIR/$CHAPTER.md
   Report of issues found in this chapter (format defined in your agent spec).
2. $SUMMARIES_DIR/$CHAPTER.md
   Knowledge snapshot for the next chapter agent. 100 lines or fewer.
   Format defined in your agent spec.

Do not stop until both files are written."

    SESSION_LOG="$FINDINGS_DIR/${CHAPTER}-session.log"
    log "Launching chapter-walker for $CHAPTER"
    if ! claude -p "$PROMPT" \
        --agent doc-chapter-walker \
        --allowedTools "Bash,Read,Write,Grep,Glob" \
        --no-session-persistence \
        --output-format text \
        < /dev/null 2>&1 | tee "$SESSION_LOG"; then
        log "WARNING: chapter-walker exited with error on $CHAPTER"
        HAD_FAILURES=1
    fi

    # Sanity check outputs
    if [ ! -f "$REPORTS_DIR/$CHAPTER.md" ]; then
        log "WARNING: no report file written for $CHAPTER"
        HAD_FAILURES=1
    fi
    if [ ! -f "$SUMMARIES_DIR/$CHAPTER.md" ]; then
        log "WARNING: no summary file written for $CHAPTER (next chapter will have less prior context)"
        HAD_FAILURES=1
    else
        _lines=$(wc -l < "$SUMMARIES_DIR/$CHAPTER.md" | tr -d ' ')
        if [ "$_lines" -gt 100 ]; then
            log "WARNING: summary for $CHAPTER is $_lines lines (>100)"
        fi
    fi
done

# --- VM cleanup ---
if [ "$SKIP_VM" -eq 0 ] && [ "$SKIP_DESTROY" -eq 0 ]; then
    log "Destroying VM"
    (cd "$SCRIPT_DIR" && vagrant destroy -f fedora)
fi
if [ "$SKIP_VM" -eq 0 ]; then
    rm -rf "$FINDINGS_DIR/.ssh"
fi

# --- analyst ---
if [ "$SKIP_ANALYST" -eq 0 ]; then
    log "Running analyst"
    if ! claude -p "Consolidate all per-chapter reports in $REPORTS_DIR/ into a single prioritized action plan at $FINDINGS_DIR/action-plan.md.

Process reports in the order they appear in index.adoc (i.e., $(list_chapters | tr '\n' ' ')).

For each report:
- Read it.
- Merge each finding into the action plan: either extend an existing entry (same root cause across chapters) or add a new entry.

The result is a single action plan, not a per-chapter dump.

$ANALYST_CONTEXT" \
        --agent doc-analyst \
        --allowedTools "Read,Write,Glob,Grep" \
        --no-session-persistence \
        --output-format text \
        < /dev/null 2>&1 | tee "$FINDINGS_DIR/analyst-session.log"; then
        log "WARNING: analyst exited with error"
        HAD_FAILURES=1
    fi
fi

log "Done. Results in $FINDINGS_DIR/"
[ -f "$FINDINGS_DIR/action-plan.md" ] && log "Action plan: $FINDINGS_DIR/action-plan.md"

if [ "$HAD_FAILURES" -eq 1 ]; then
    log "One or more warnings occurred — check session logs"
    exit 1
fi
