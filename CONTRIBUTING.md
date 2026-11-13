# Contributing to Crowdfunding Market-Test MVP

Thank you for your interest in contributing! This project is an open-source, public repository licensed under Apache-2.0.

---

## Operating Protocol

1. **One Step / Feature at a Time:** Keep pull requests scoped tightly to their specific task. Avoid unrelated refactorings or bundle-ups.
2. **Never Commit Secrets:** Never commit real secrets, API keys, private credentials, or live `.env` files. Use `.env.example` with non-sensitive placeholders.
3. **Tests & Verification:** Ensure all linters, type checks, and tests pass with zero errors before submitting PRs.

---

## Branching & PR Flow

1. Create a branch off `main` with a clear prefix:
   - Implementation plan steps: `step/<id>-<slug>` (e.g., `step/0.1-repo-hygiene`)
   - Fixes: `fix/<short-description>`
   - Features: `feat/<short-description>`
2. Push your branch and open a Pull Request into `main`.
3. Complete the PR checklist defined in the pull request template.
4. Ensure all CI checks are green prior to requesting review / merge.

---

## Conventional Commits

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```
<type>(<scope>): <short description in present tense>

[optional body]

[optional footer(s)]
```

Common types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation updates only
- `chore`: Maintenance, repo hygiene, tooling updates
- `test`: Adding or correcting tests
- `ci`: CI/CD workflows and automation

---

## Developer Certificate of Origin (DCO)

To certify that you wrote or have the right to submit the code you are contributing, every commit must include a Developer Certificate of Origin (DCO) sign-off line in the commit message:

```
Signed-off-by: Full Name <author@example.com>
```

You can automatically add this line by using the `-s` or `--signoff` flag when committing:
```bash
git commit -s -m "chore(repo): add repository hygiene files"
```

By providing a sign-off, you certify the following (DCO version 1.1):
```text
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it; and

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

---

## License

By contributing to this repository, you agree that your contributions will be licensed under the [Apache-2.0 License](LICENSE).
