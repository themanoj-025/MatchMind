# AGENTS.md — Match-Mind

> Canonical project instructions. Pointers like `CLAUDE.md` or
> `.github/copilot-instructions.md` should say "See AGENTS.md".

---

## Project overview

**Match-Mind** — a matching engine for matching candidates to roles or
pairs. Core components:

- **ML** — matching model and scoring logic.
- **Model** — trained matcher, evaluation harness.
- **API** — FastAPI service exposing match recommendations.
- **Web / App** — frontend consuming the API.

Stack: Python 3.11+ · scikit-learn / XGBoost · FastAPI · Streamlit.

---

## Exact commands

```bash
# Install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Lint / typecheck / test
make lint
pre-commit run --all-files
python -m mypy . --ignore-missing-imports
python -m pytest tests/ -v --cov=. --cov-fail-under=70

# Run
uvicorn api.main:app --reload
streamlit run dashboard/app.py
```

---

## Folder map

| Path                 | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `ml/`                | Matching model + scoring                 |
| `model/`             | Training/evaluation scripts              |
| `api/`               | FastAPI application                      |
| `dashboard/`         | Streamlit dashboard                      |
| `tests/`             | pytest suite                             |
| `.github/workflows/` | CI (ruff, mypy, pytest, gitleaks, trivy) |

## Do / don't

- **Do** keep the scoring interface stable so the model can swap without
  breaking the API.
- **Do not** commit `.env` files.
- **Do not** commit raw user data (PII).

## Security rules

- No secrets in the repository; `gitleaks` CI gate gates on hits.
- PII must be masked or tokenized before any file leaves the sandbox.

## AI-assistance convention

Commits authored by AI must carry the trailer:

```text
AI-Assisted: yes | no | partial
```

See `.gitmessage` for the template. Do not rewrite historic commits
retroactively.
