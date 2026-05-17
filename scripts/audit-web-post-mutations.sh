#!/usr/bin/env bash
set -euo pipefail

violations=0

echo "Auditing web direct post mutations..."
while IFS=: read -r file line _text; do
  block="$(sed -n "${line},$((line + 10))p" "${file}")"
  if [[ "${block}" == *".insert("* || "${block}" == *".update("* || "${block}" == *".delete()"* ]]; then
    echo "Forbidden direct web posts mutation at ${file}:${line}" >&2
    violations=1
  fi
done < <(rg -n "\\.from\\(['\\\"]posts['\\\"]\\)" apps/web -g '*.ts' -g '*.tsx')

if [[ "${violations}" -ne 0 ]]; then
  echo "Web post mutation audit failed." >&2
  exit 1
fi

echo "Web post mutation audit passed."
