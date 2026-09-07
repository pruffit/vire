#!/usr/bin/env bash
# Сводка состояния git/GitHub в начало сессии: что висит открытым и что упало.
# Только чтение. Молчит, если gh недоступен или это не репозиторий.
set -u

git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
dirty=$(git status --porcelain 2>/dev/null | grep -c . || true)
echo "git: ветка ${branch}, незакоммиченных путей — ${dirty}"

command -v gh >/dev/null 2>&1 || exit 0
gh auth status >/dev/null 2>&1 || exit 0

prs=$(gh pr list --state open --limit 10 \
  --json number,title,headRefName,isDraft \
  --template '{{range .}}  #{{.number}} {{.title}} ({{.headRefName}}){{if .isDraft}} [draft]{{end}}{{"\n"}}{{end}}' 2>/dev/null || true)
[ -n "${prs}" ] && printf 'открытые PR:\n%s\n' "${prs}"

issues=$(gh issue list --state open --limit 10 \
  --json number,title,labels \
  --template '{{range .}}  #{{.number}} {{.title}}{{"\n"}}{{end}}' 2>/dev/null || true)
[ -n "${issues}" ] && printf 'открытые issues:\n%s\n' "${issues}"

runs=$(gh run list --limit 3 \
  --json conclusion,displayTitle,headBranch \
  --template '{{range .}}  {{.conclusion}} — {{.displayTitle}} ({{.headBranch}}){{"\n"}}{{end}}' 2>/dev/null || true)
[ -n "${runs}" ] && printf 'последние прогоны CI:\n%s\n' "${runs}"

exit 0
