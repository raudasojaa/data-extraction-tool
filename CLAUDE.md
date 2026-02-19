# CLAUDE.md

This file provides guidance for AI assistants (e.g. Claude) working in this repository.

---

## Project Overview

**Repository:** `data-extraction-tool`
**Status:** Early-stage / scaffolding phase

This project is a data extraction tool. As of the initial commit, the repository contains only a `README.md`. No source code, build system, or dependency manifest has been added yet.

---

## Current Repository Structure

```
data-extraction-tool/
├── .git/
├── README.md        # Project title only
└── CLAUDE.md        # This file
```

---

## Development Workflow

### Branching

- `master` is the main branch.
- Feature and AI-assisted development branches follow the pattern:
  `claude/<session-descriptor>-<session-id>`
- Always develop on a designated feature branch; never push directly to `master` without review.

### Git Practices

- Write clear, descriptive commit messages summarizing *what changed and why*.
- Stage specific files rather than using `git add -A` to avoid accidentally committing secrets or build artifacts.
- Do not force-push to `master`.

---

## Setting Up the Project

> The project has not yet defined its language, runtime, or dependency manager. Once those decisions are made, update this section with:
>
> - Runtime version (e.g. Python 3.x, Node.js vX)
> - Dependency installation command (e.g. `pip install -r requirements.txt`, `npm install`)
> - Environment variable setup (e.g. `.env` file requirements, secrets management)

---

## Running the Tool

> Document the primary entry point and execution command here once source code is added.
>
> Example placeholders:
> ```bash
> # Python
> python main.py --input <source> --output <destination>
>
> # Node.js
> node index.js --input <source> --output <destination>
> ```

---

## Testing

> No test framework has been configured yet. Once tests are added, document:
>
> - Test runner and command (e.g. `pytest`, `npm test`, `go test ./...`)
> - How to run a single test
> - Required environment for tests (mocks, fixtures, test databases)

---

## Linting and Formatting

> No linter or formatter has been configured yet. Once tooling is chosen, document:
>
> - Linting command (e.g. `flake8 .`, `eslint src/`, `golangci-lint run`)
> - Formatting command (e.g. `black .`, `prettier --write .`, `gofmt -w .`)
> - Whether these are enforced in CI or pre-commit hooks

---

## Key Conventions for AI Assistants

1. **Read before modifying.** Always read a file before editing it. Never guess at existing content.
2. **Minimal changes.** Only change what is directly requested or clearly necessary. Avoid unsolicited refactoring, additional error handling, or extra abstractions.
3. **No secrets in commits.** Never commit `.env` files, credentials, API keys, or other secrets.
4. **Respect the branch model.** All work should land on the designated feature branch; push with `git push -u origin <branch-name>`.
5. **Update this file.** When the project gains a language, framework, test suite, or linting setup, update the relevant sections above to keep this document accurate.
6. **Security.** Do not introduce injection vulnerabilities (SQL, command, XSS) or other OWASP Top 10 issues. Validate only at system boundaries (user input, external APIs).

---

## Future Sections to Add

As the project evolves, add sections covering:

- **Architecture** — high-level data flow and component responsibilities
- **Data Sources** — supported input formats and connection methods
- **Output Formats** — supported export targets and schemas
- **Configuration** — config file format and available options
- **CI/CD** — pipeline definition and deployment process
- **Dependency Management** — how to add, pin, or audit dependencies
