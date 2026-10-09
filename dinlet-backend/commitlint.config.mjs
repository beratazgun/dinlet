/**
 * Conventional Commits kuralları (feat:, fix:, chore:, refactor: ...).
 * commit-msg hook'unda `commitlint --edit` ile çalışır.
 */
export default {
  extends: ["@commitlint/config-conventional"],
};
