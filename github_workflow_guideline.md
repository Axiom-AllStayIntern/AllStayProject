# GitHub Workflow Guideline

## Team Members

```text
chamus
kevin
aki
```

---

## 1. Branch Strategy

The team uses **Feature Branching**.

`main` is the stable branch.

All development work must be done in feature branches.

```text
main
├── dev
├── feature/chamus-<task>
├── feature/kevin-<task>
└── feature/aki-<task>
```

Examples:

```text
feature/chamus-book-trasport
feature/kevin-book-spa
feature/aki-order-food
```

---

## 2. Core Rules

```text
1. Do not develop directly on main.
2. Create one feature branch for each task.
3. Push only to your own feature branch.
4. Merge changes through Pull Requests.
5. Do not force-push to main (and other --force command).
6. Do not delete another member's branch.
7. Do not commit secrets or sensitive data.
```

---

## 3. Start a New Task

Update `main` first:

```bash
git checkout main
git pull origin main
```

Create a feature branch:

```bash
git checkout -b feature/<name>-<task>
```

Example:

```bash
git checkout -b feature/aki-invoice-upload
```

Push the branch:

```bash
git push -u origin feature/aki-invoice-upload
```

---

## 4. Commit Changes

Check status:

```bash
git status
```

Stage changes:

```bash
git add .
```

Commit:

```bash
git commit -m "feat: add invoice upload"
```

Push:

```bash
git push
```

---

## 4b. Commit Message Format
Use:

```text
<type>: <short description>
```

Common types:

```text
feat: new feature
fix: bug fix
docs: documentation
refactor: code restructuring
chore: maintenance
```

Examples:

```bash
git commit -m "feat: add upload page"
git commit -m "fix: handle empty file"
git commit -m "docs: update setup guide"
```

---

## 5. Pull Request

When the feature is ready, open a Pull Request on github platform:
```text
Compare & pull request
or
Pull requests → New pull request
```
Then, choose merge direction:

```text
feature/<name>-<task> -> dev
```

Pull Request title example:

```text
feat: add invoice upload
```

Pull Request description should include:

```text
1. What changed
2. How it was tested
3. Any risks or notes
```

---

## 7. Review and Merge

Before merging:

```text
1. The Pull Request targets dev.
2. The branch has no unresolved conflicts.
3. At least one other member has reviewed it.
4. The project runs locally.
5. No secrets or sensitive files are included.
```

Recommended policy:

After we all agree that `dev` branch passes, then merges into `main`.


---

## 8. Keep Your Branch Updated

If `dev` changes while you are working:

```bash
git checkout dev
git pull origin dev
git checkout feature/<name>-<task>
git merge dev
```

Resolve conflicts if required, then:

```bash
git add .
git commit -m "fix: resolve merge conflict"
git push
```

---

## 9. After Merge

Update local `main`:

```bash
git checkout main
git pull origin main
```

Delete the local feature branch:

```bash
git branch -d feature/<name>-<task>
```

---

## 10. Prohibited Actions

Do not run:

```bash
git push --force origin main
git push -f origin main
git push --delete origin main
git push --delete origin <another-member-branch>
git reset --hard origin/main
```

---

## 11. Sensitive Data

Never commit:

```text
.env
API keys
database passwords
access tokens
customer data
financial documents
private credentials
```

If sensitive data is committed, notify the others immediately and revoke the exposed secret.

If there are your own files need to be exclude, put relative path into `.git/info/exclude`:

```text
gitbash: code .git/info/exclude
```

write in examples:
```text
ref_files/
```

---

## 12. Minimum Workflow

```text
1. Pull latest dev.
2. Create a feature branch.
3. Develop on the feature branch.
4. Commit and push changes.
5. Open a Pull Request.
6. Request review.
7. Merge after approval.
8. Pull updated dev.
9. Delete completed feature branch.
```
