# DEAD-WEIGHT PURGE v2.0 AUDIT REPORT

**Repository**: `Match-Mind`  
**Mode**: `AUDIT_ONLY` (Zero repository modifications performed)  
**Baseline Commit SHA**: `9845c5504060c4ccffd2daef5ec2a195c62cf4e0`  
**Audit Date**: 2026-10-11  
**Verdict**: **YELLOW** (Dead weight detected; review recommended)

---

## 1. Executive Summary

- **Tracked Files in Git**: 405
- **Untracked Local Files**: 9
- **Total LOC**: 1,19,873
- **Analyzed Size**: 5.11 MB
- **Total Dead-Weight Candidates Identified**: 212
  - **Tier 0 (Provable Junk/Empty)**: 59
  - **Tier 1 (High Confidence)**: 17
  - **Tier 2 (Medium / Needs Verification)**: 136
  - **Tier 3 (Protected / Hard Vetoed)**: 0

## 2. Findings by Category

| Category | Description | Count |
|---|---|---|
| **A** | Empty & Near-Empty Files | 1 |
| **C** | Junk / Caches / Build Artifacts | 58 |
| **D** | Potential Orphan Modules | 136 |
| **H** | Exact Hash Duplicates | 17 |

### Top Tier-0 Items (Provable Deletion Candidates if EXECUTE_SAFE were used):
- [`A`] `py.typed`: 0-byte file with no content
- [`C`] `.cleanup-audit/`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.cleanup-audit/.claude/`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.env`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.gemini/`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.github/copilot-instructions.md`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/.gitignore`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/applypatch-msg`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/commit-msg`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/h`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/husky.sh`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/post-applypatch`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/post-checkout`: Untracked build/dependency/cache artifact directory in workspace
- [`C`] `.husky/_/post-commit`: Untracked build/dependency/cache artifact directory in workspace
_...and 44 more listed in `manifest.csv`._

## 3. Next Steps & Recommended Actions

1. Review `.purge-reports/manifest.csv` and `.purge-reports/FLAGGED.md`.
2. If safe cleanup is desired, configure `MODE: EXECUTE_SAFE` or generate an approval `PLAN.yaml`.
3. Verify that all untracked artifacts (`__pycache__`, `.venv`, `.pytest_cache`) are properly covered in `.gitignore`.
