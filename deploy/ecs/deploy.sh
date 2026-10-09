#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd -- "$SCRIPT_DIRECTORY/../.." && pwd)
NOTEHUB_SOURCE=${NOTEHUB_SOURCE:-/Users/redkun/note/MyNote/NoteHub}
DEPLOY_HOST=${DEPLOY_HOST:-root@139.196.212.191}
DEPLOY_PORT=${DEPLOY_PORT:-22}
REMOTE_APP_ROOT=${REMOTE_APP_ROOT:-/opt/markdown-note-manager}
REMOTE_NOTE_ROOT=${REMOTE_NOTE_ROOT:-/srv/notehub}
RELEASE_ID=${RELEASE_ID:-$(date -u +%Y%m%dT%H%M%SZ)}
REMOTE_RELEASE="$REMOTE_APP_ROOT/releases/$RELEASE_ID"

SSH_ARGUMENTS=(-p "$DEPLOY_PORT")
if [[ -n "${DEPLOY_IDENTITY_FILE:-}" ]]; then
  SSH_ARGUMENTS+=(-i "$DEPLOY_IDENTITY_FILE" -o IdentitiesOnly=yes)
fi
if [[ -n "${DEPLOY_CONTROL_PATH:-}" ]]; then
  SSH_ARGUMENTS+=(-S "$DEPLOY_CONTROL_PATH" -o ControlMaster=no)
fi

RSYNC_SSH=(ssh "${SSH_ARGUMENTS[@]}")
printf -v RSYNC_RSH '%q ' "${RSYNC_SSH[@]}"

ssh_remote() {
  ssh "${SSH_ARGUMENTS[@]}" "$DEPLOY_HOST" "$@"
}

for command_name in git node pnpm rsync ssh; do
  command -v "$command_name" >/dev/null || {
    echo "Missing local command: $command_name" >&2
    exit 1
  }
done

[[ -d "$NOTEHUB_SOURCE" ]] || {
  echo "NoteHub source does not exist: $NOTEHUB_SOURCE" >&2
  exit 1
}

APP_STAGE=$(mktemp -d "${TMPDIR:-/tmp}/markdown-note-manager-app.XXXXXX")
NOTE_STAGE=$(mktemp -d "${TMPDIR:-/tmp}/markdown-note-manager-notes.XXXXXX")
cleanup() {
  rm -rf -- "$APP_STAGE" "$NOTE_STAGE"
}
trap cleanup EXIT

echo "Building application..."
pnpm --dir "$PROJECT_ROOT" install --frozen-lockfile
pnpm --dir "$PROJECT_ROOT" build

mkdir -p "$APP_STAGE/apps/server" "$APP_STAGE/apps/web"
cp "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/pnpm-lock.yaml" "$PROJECT_ROOT/pnpm-workspace.yaml" "$APP_STAGE/"
cp "$PROJECT_ROOT/apps/server/package.json" "$APP_STAGE/apps/server/"
cp "$PROJECT_ROOT/apps/web/package.json" "$APP_STAGE/apps/web/"
cp -R "$PROJECT_ROOT/apps/server/dist" "$APP_STAGE/apps/server/"
cp -R "$PROJECT_ROOT/apps/web/dist" "$APP_STAGE/apps/web/"

echo "Creating a credential-free NoteHub snapshot..."
rm -rf -- "$NOTE_STAGE"
git clone --quiet --depth 1 --no-tags "file://$NOTEHUB_SOURCE" "$NOTE_STAGE"
git -C "$NOTE_STAGE" remote remove origin
rsync -a --delete \
  --exclude='/.git/' \
  --exclude='/.DS_Store' \
  --exclude='/.aws/' \
  --exclude='/.agents/' \
  --exclude='/.codex/' \
  --exclude='/.codebuddy/' \
  --exclude='/.workbuddy/' \
  --exclude='/node_modules/' \
  "$NOTEHUB_SOURCE/" "$NOTE_STAGE/"

echo "Uploading application release $RELEASE_ID..."
ssh_remote "install -d -m 0755 '$REMOTE_RELEASE' '$REMOTE_NOTE_ROOT'"
rsync -az --delete -e "$RSYNC_RSH" "$APP_STAGE/" "$DEPLOY_HOST:$REMOTE_RELEASE/"

echo "Uploading NoteHub snapshot..."
rsync -az --delete -e "$RSYNC_RSH" "$NOTE_STAGE/" "$DEPLOY_HOST:$REMOTE_NOTE_ROOT/"

echo "Installing production dependencies and activating release..."
ssh_remote "set -eu; \
  cd '$REMOTE_RELEASE'; \
  corepack pnpm install --prod --frozen-lockfile; \
  chown -R notehub:notehub '$REMOTE_RELEASE' '$REMOTE_NOTE_ROOT'; \
  ln -sfn '$REMOTE_RELEASE' '$REMOTE_APP_ROOT/current.next'; \
  mv -Tf '$REMOTE_APP_ROOT/current.next' '$REMOTE_APP_ROOT/current'; \
  systemctl restart markdown-note-manager"

echo "Verifying service..."
ssh_remote "set -eu; systemctl is-active --quiet markdown-note-manager; curl --fail --silent http://127.0.0.1:43110/api/health"
echo
echo "Deployment completed: $REMOTE_RELEASE"
