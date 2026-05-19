#!/usr/bin/env bash
set -euo pipefail

violations=0
pattern="\\.from\\(['\\\"]posts['\\\"]\\)"

find_post_table_refs() {
  if command -v rg >/dev/null 2>&1; then
    rg -n "${pattern}" apps/web -g '*.ts' -g '*.tsx' || true
    return
  fi

  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git grep -n -E "${pattern}" -- 'apps/web/**/*.ts' 'apps/web/**/*.tsx' || true
    return
  fi

  grep -RInE --include='*.ts' --include='*.tsx' "${pattern}" apps/web || true
}

echo "Auditing web direct post mutations..."
while IFS=: read -r file line _text; do
  [[ -z "${file}" || -z "${line}" ]] && continue
  block="$(sed -n "${line},$((line + 10))p" "${file}")"
  if [[ "${block}" == *".insert("* || "${block}" == *".update("* || "${block}" == *".delete()"* ]]; then
    echo "Forbidden direct web posts mutation at ${file}:${line}" >&2
    violations=1
  fi
done < <(find_post_table_refs)

if [[ "${violations}" -ne 0 ]]; then
  echo "Web post mutation audit failed." >&2
  exit 1
fi

echo "Web post mutation audit passed."
