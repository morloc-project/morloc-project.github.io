#!/bin/sh
# Morloc tutorial generation orchestrator
#
# Generates morloc projects via Claude Code agents running in a Fedora VM.
# Each project is ideated, implemented, compiled, tested, and documented.
# Designed for unattended runs (~15-20 min per project).
#
# Prerequisites:
#   - vagrant + vagrant-libvirt plugin
#   - claude CLI (Claude Code)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# The docs site repo is one level above coding-agents/
DOCS_SITE_DIR="$(cd "$REPO_DIR/.." && pwd)"
# The morloc workspace is three levels above the docs site
WORKSPACE_DIR="$(cd "$DOCS_SITE_DIR/../../.." && pwd)"

# Documentation content lives in the docs site repo
DOCS_DIR="$DOCS_SITE_DIR/src/content"
# These may not exist in all workspace configurations
STDLIB_CLAUDE="$WORKSPACE_DIR/lib/stdlib/CLAUDE.md"
EXAMPLES_DIR="$WORKSPACE_DIR/usage/examples/demos"

ALL_PERSONAS=$(cd "$SCRIPT_DIR/personas" && ls *.md 2>/dev/null | sed 's/\.md$//')

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Generate morloc tutorial projects via autonomous agent-based coding.

Options:
  -h, --help                Show this help message
  --info                    List available personas
  -n, --count N             Number of projects to generate (default: 1)
  -f, --focus TEXT          Hint or topic to guide project ideation
                            (e.g., --focus "build a Monte Carlo simulation")
  --personas LIST           Comma-separated list of personas to cycle through
                            (default: all)
  --no-vm                   Skip VM setup (assume VM is already running)
  --no-analyst              Skip the analyst phase

Examples:
  $(basename "$0")
  $(basename "$0") -n 3 --personas scientist,teacher
  $(basename "$0") -f "text processing pipeline" --personas data-scientist
EOF
}

show_info() {
    echo "Available personas:"
    for p in $ALL_PERSONAS; do
        _desc=""
        _file="$SCRIPT_DIR/personas/$p.md"
        if [ -f "$_file" ]; then
            _desc=$(head -1 "$_file")
        fi
        if [ -n "$_desc" ]; then
            printf "  %-18s %s\n" "$p" "$_desc"
        else
            printf "  %s\n" "$p"
        fi
    done
}

FOCUS=""
PERSONAS=""
COUNT=1
SKIP_VM=0
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
        -n|--count)
            COUNT="$2"
            shift 2
            ;;
        --personas)
            PERSONAS=$(echo "$2" | tr ',' ' ')
            shift 2
            ;;
        --no-vm)
            SKIP_VM=1
            shift
            ;;
        --no-analyst)
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

PERSONAS="${PERSONAS:-$ALL_PERSONAS}"

cd "$REPO_DIR"

mkdir -p findings projects

# Read customizable context files
BUILDER_CONTEXT=""
if [ -f "$SCRIPT_DIR/builder-context.md" ]; then
    BUILDER_CONTEXT=$(cat "$SCRIPT_DIR/builder-context.md")
fi
ANALYST_CONTEXT=""
if [ -f "$SCRIPT_DIR/analyst-context.md" ]; then
    ANALYST_CONTEXT=$(cat "$SCRIPT_DIR/analyst-context.md")
fi

log() {
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') $* ==="
}

# Load known-issues content for prompt injection
load_known_issues() {
    KNOWN_ISSUES=""
    if [ -f "findings/known-issues.md" ]; then
        KNOWN_ISSUES=$(cat "findings/known-issues.md")
    fi
}

# Update known-issues.md after a project completes (lightweight summarizer)
generate_known_issues() {
    _project_dir="$1"
    _project_id="$2"

    log "Updating known-issues.md from $_project_dir"
    claude -p "Read the report and any finding files in $_project_dir/ and findings/$_project_id/ (if they exist), plus the current findings/known-issues.md (if it exists; if not, create it).

For each NEW issue found by this project that is not already listed:
- Add a one-line entry under the appropriate section:
  - 'Known Morloc Bugs (work around these)' for compiler/runtime bugs — include a workaround if one was found (prefix KB-N)
  - 'Known Documentation Issues (do not re-report)' for doc issues (prefix KD-N)
- Do NOT duplicate entries already present — check carefully before adding
- Number entries sequentially from the highest existing number

Update the Coverage Heatmap table:
- For each morloc feature or area this project exercised, increment its pass count by 1
- Record '$_project_id' in the 'Last covered by' column (append to existing entries)
- Features include: records, optionals, effects, guards, where-clauses, patterns, modules, source imports, C++ backend, Python backend, CLI docstrings, etc.

Use this format for the file:

\`\`\`
# Known Issues

## Known Morloc Bugs (work around these)
- KB-1: <description> — <workaround>

## Known Documentation Issues (do not re-report)
- KD-1: <description>

## Coverage Heatmap
| Feature/Area | Projects | Last covered by |
|--------------|----------|-----------------|
| records | 2 | 2026-03-22-gibbs-sampler, 2026-03-23-text-stats |
\`\`\`

Write the result to findings/known-issues.md." \
        --allowedTools "Read,Write,Glob" \
        --no-session-persistence \
        --output-format text \
        --max-turns 10 \
        < /dev/null > "findings/known-issues-update.log" 2>&1 || \
        log "WARNING: known-issues update failed (non-fatal)"
}

# Generate the docs bundle by concatenating key documentation files
generate_docs_bundle() {
    _bundle="$SCRIPT_DIR/docs-bundle.md"
    log "Generating docs bundle"

    : > "$_bundle"

    if [ -f "$STDLIB_CLAUDE" ]; then
        echo "# Standard Library Reference" >> "$_bundle"
        echo "" >> "$_bundle"
        cat "$STDLIB_CLAUDE" >> "$_bundle"
        echo "" >> "$_bundle"
    fi

    for _doc in \
        getting-started.asc \
        features-source.asc \
        features-functions.asc \
        features-types.asc \
        features-records.asc \
        features-optionals.asc \
        features-modules.asc \
        features-effects.asc \
        features-guards.asc \
        features-where.asc \
        features-patterns.asc \
        features-infix.asc \
        features-intrinsics.asc \
        features-recursion.asc \
        features-tables.asc \
        features-tensors.asc \
    ; do
        _path="$DOCS_DIR/$_doc"
        if [ -f "$_path" ]; then
            echo "# $(echo "$_doc" | sed 's/\.asc$//' | tr '-' ' ')" >> "$_bundle"
            echo "" >> "$_bundle"
            cat "$_path" >> "$_bundle"
            echo "" >> "$_bundle"
        fi
    done

    _lines=$(wc -l < "$_bundle")
    log "Docs bundle: $_lines lines"
}

# Extract SSH connection details from vagrant
extract_ssh_config() {
    _ssh_dir="$REPO_DIR/findings/.ssh"
    mkdir -p "$_ssh_dir"

    _ssh_config=$(cd "$SCRIPT_DIR" && vagrant ssh-config fedora)

    SSH_HOST=$(echo "$_ssh_config" | awk '/HostName/ {print $2}')
    SSH_PORT=$(echo "$_ssh_config" | awk '/Port/ {print $2}')
    SSH_USER=$(echo "$_ssh_config" | awk '/User / {print $2}')
    # Take only the first IdentityFile (vagrant ssh-config may list several)
    _key_path=$(echo "$_ssh_config" | awk '/IdentityFile/ {print $2; exit}')

    SSH_KEY="$_ssh_dir/fedora_key"
    cp "$_key_path" "$SSH_KEY"
    chmod 600 "$SSH_KEY"
}

# Pick the next persona in round-robin order
# Uses a counter file to persist position across runs
pick_persona() {
    _counter_file="$REPO_DIR/.persona-counter"
    _idx=0
    if [ -f "$_counter_file" ]; then
        _idx=$(cat "$_counter_file")
    fi

    # Convert persona list to indexed access
    _count=0
    for _p in $PERSONAS; do
        _count=$((_count + 1))
    done

    _pick_idx=$((_idx % _count))
    _cur=0
    CURRENT_PERSONA=""
    for _p in $PERSONAS; do
        if [ "$_cur" -eq "$_pick_idx" ]; then
            CURRENT_PERSONA="$_p"
            break
        fi
        _cur=$((_cur + 1))
    done

    # Increment counter
    echo "$((_idx + 1))" > "$_counter_file"
}

# Update manifest.json after a project completes
update_manifest() {
    _project_id="$1"
    _persona="$2"
    _project_dir="$REPO_DIR/projects/$_project_id"

    # Determine status
    _status="failed"
    if [ -f "$_project_dir/run.log" ]; then
        _status="success"
    elif [ -f "$_project_dir/build.log" ] && [ -f "$_project_dir/exe" ]; then
        _status="partial"
    fi

    # Extract title from report.md if it exists
    _title="$_project_id"
    if [ -f "$_project_dir/report.md" ]; then
        _maybe_title=$(head -5 "$_project_dir/report.md" | sed -n 's/^#[[:space:]]*//p' | head -1)
        if [ -n "$_maybe_title" ]; then
            _title="$_maybe_title"
        fi
    fi

    _timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # Use python to safely update JSON (title passed via env to avoid injection)
    MANIFEST_ID="$_project_id" \
    MANIFEST_PERSONA="$_persona" \
    MANIFEST_TITLE="$_title" \
    MANIFEST_STATUS="$_status" \
    MANIFEST_TIMESTAMP="$_timestamp" \
    python3 -c "
import json, os
with open('manifest.json', 'r') as f:
    data = json.load(f)
data['projects'].append({
    'id': os.environ['MANIFEST_ID'],
    'persona': os.environ['MANIFEST_PERSONA'],
    'title': os.environ['MANIFEST_TITLE'],
    'status': os.environ['MANIFEST_STATUS'],
    'timestamp': os.environ['MANIFEST_TIMESTAMP']
})
with open('manifest.json', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
}

# --- Main ---

generate_docs_bundle

if [ "$SKIP_VM" -eq 0 ]; then
    log "Starting VM"
    (cd "$SCRIPT_DIR" && vagrant up fedora)

    if ! (cd "$SCRIPT_DIR" && vagrant ssh fedora -c "echo 'VM ready'" 2>/dev/null); then
        log "FAIL: VM not reachable"
        exit 1
    fi
fi

extract_ssh_config
SSH_CMD="ssh -i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR $SSH_USER@$SSH_HOST"
log "SSH config: $SSH_USER@$SSH_HOST:$SSH_PORT"

# Sync files to VM
log "Syncing files to VM"
(cd "$SCRIPT_DIR" && vagrant rsync fedora)

_i=0
while [ "$_i" -lt "$COUNT" ]; do
    _i=$((_i + 1))
    pick_persona
    _date=$(date +%Y-%m-%d)

    log "Project $_i/$COUNT (persona: $CURRENT_PERSONA)"

    PERSONA_FILE="$SCRIPT_DIR/personas/$CURRENT_PERSONA.md"
    if [ ! -f "$PERSONA_FILE" ]; then
        log "WARNING: persona file $PERSONA_FILE not found, skipping"
        continue
    fi

    # Load accumulated known-issues for prompt injection
    load_known_issues
    KNOWN_ISSUES_BLOCK=""
    if [ -n "$KNOWN_ISSUES" ]; then
        KNOWN_ISSUES_BLOCK="
== Known Morloc Issues ==
These bugs have been confirmed by previous projects. Use the documented workarounds to avoid getting stuck on them. Focus your exploration on features and areas not yet well-covered (see the Coverage Heatmap).
$KNOWN_ISSUES"
    fi

    # The agent will create the actual project directory with a chosen short name.
    # We provide a temp name; the agent replaces it.
    _temp_id="${_date}-project-${_i}"

    PROMPT="You are building a morloc project in a VM.

== SSH Access ==
SSH into the VM with: $SSH_CMD \"<your command>\"
Run morloc commands as: $SSH_CMD \"cd /vagrant/projects/<your-project-id> && morloc-manager run morloc make -o exe main.loc\"
Test executables as: $SSH_CMD \"cd /vagrant/projects/<your-project-id> && morloc-manager run ./exe -h\"

IMPORTANT: Before building, sync your project files to the VM:
  rsync -e 'ssh -i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null' -av projects/<your-project-id>/ $SSH_USER@$SSH_HOST:/vagrant/projects/<your-project-id>/

== Project Setup ==
Date: $_date
Create your project directory at: projects/${_date}-<your-short-name>/
Write findings to: findings/${_date}-<your-short-name>/

== Your Persona ==
$(cat "$PERSONA_FILE")

== Existing Projects (do NOT repeat these concepts) ==
$(cat manifest.json)

== Morloc Documentation ==
The following is the AUTHORITATIVE morloc language documentation. Do NOT guess
syntax from other languages. When unsure about morloc syntax, refer back to
these docs. Key differences from Haskell: record field access uses dot syntax
(\`.field record\` not \`field record\`), let bindings use separate \`let\` per
binding, effects use angle brackets (\`<Rand>\`).

$(cat "$SCRIPT_DIR/docs-bundle.md")
$(
# Include reference examples if they exist
_refs=""
if [ -d "$EXAMPLES_DIR" ]; then
    for _ex in "$EXAMPLES_DIR"/todo-list/main.loc "$EXAMPLES_DIR"/dnd/fate/main.loc; do
        if [ -f "$_ex" ]; then
            _refs="${_refs:+$_refs
}  $_ex"
        fi
    done
fi
if [ -n "$_refs" ]; then
    echo "== Reference Examples (read these for correct patterns) =="
    echo "Host paths you can read:"
    echo "$_refs"
fi
)

$BUILDER_CONTEXT${FOCUS:+

FOCUS: $FOCUS}$KNOWN_ISSUES_BLOCK"

    # Launch builder agent (30 min timeout)
    timeout 1800 claude -p "$PROMPT" \
        --agent project-builder \
        --allowedTools "Bash,Read,Write,Glob,Grep" \
        --no-session-persistence \
        --output-format text \
        < /dev/null 2>&1 | tee "projects/${_temp_id}-session.log" || true

    # Find the actual project directory the agent created
    _actual_dir=""
    for _d in projects/${_date}-*/; do
        if [ -d "$_d" ] && [ "$_d" != "projects/${_temp_id}-session.log" ]; then
            # Check if this is a new directory (has main.loc or report.md)
            if [ -f "${_d}main.loc" ] || [ -f "${_d}report.md" ]; then
                _actual_dir="$_d"
            fi
        fi
    done

    if [ -n "$_actual_dir" ]; then
        _actual_id=$(basename "$_actual_dir")
        # Move session log into the project directory
        mv "projects/${_temp_id}-session.log" "${_actual_dir}session.log" 2>/dev/null || true
        update_manifest "$_actual_id" "$CURRENT_PERSONA"
        generate_known_issues "$_actual_dir" "$_actual_id"
        log "Done: $_actual_id (persona: $CURRENT_PERSONA)"
    else
        log "WARNING: No project directory found for run $_i"
    fi
done

# Run analyst
if [ "$SKIP_ANALYST" -eq 0 ]; then
    KNOWN_ISSUES_HINT=""
    if [ -f "findings/known-issues.md" ]; then
        KNOWN_ISSUES_HINT="

Start by reading findings/known-issues.md for a high-level map of all known issues and a coverage heatmap before processing individual reports."
    fi

    log "Running analyst agent"
    claude -p "Fold across all project reports and findings in this workspace. Initialize findings/action-plan.md, then process each report and finding one at a time: compare it to existing entries in the action plan, either merge it into an existing root cause or add a new one. The result should be a single consolidated action plan, not a per-report analysis.

Look at:
- projects/*/report.md
- projects/*/tutorial.md
- findings/*/finding-*.md
$KNOWN_ISSUES_HINT
$ANALYST_CONTEXT" \
        --agent project-analyst \
        --allowedTools "Read,Write,Glob,Grep" \
        --no-session-persistence \
        --output-format text \
        < /dev/null 2>&1 | tee "findings/analyst-session.log"
fi

# Clean up SSH keys
rm -rf "findings/.ssh"

log "Tutorial generation complete"
log "  Projects: projects/"
log "  Findings: findings/action-plan.md"
log "  Manifest: manifest.json"
echo ""
echo "Project Summary:"
printf "  %-35s %-18s %s\n" "ID" "PERSONA" "STATUS"
printf "  %-35s %-18s %s\n" "---" "-------" "------"
python3 -c "
import json
with open('manifest.json') as f:
    data = json.load(f)
for p in data['projects']:
    print(f\"  {p['id']:<35} {p['persona']:<18} {p['status']}\")
" 2>/dev/null || true
