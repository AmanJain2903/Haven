# GitHub Actions CI/CD Setup Guide

## Overview
This guide explains how to configure GitHub Actions for Haven's CI/CD pipeline, including automated testing, coverage tracking, and branch protection.

## 📋 Prerequisites

1. **GitHub Repository**: Haven repository with admin access
2. **Codecov Account**: Sign up at https://codecov.io (free for open source)
3. **GitHub Secrets**: Access to repository settings

## 🔧 Setup Steps

### 1. Codecov Integration

#### a) Create Codecov Account
1. Go to https://codecov.io
2. Sign in with GitHub
3. Grant access to the Haven repository
4. Copy your **Codecov token** (shown on the setup page)

#### b) Add Codecov Token to GitHub Secrets
1. Navigate to: `Settings` → `Secrets and variables` → `Actions`
2. Click `New repository secret`
3. Name: `CODECOV_TOKEN`
4. Value: Paste your Codecov token
5. Click `Add secret`

### 2. Coverage Badge (Optional)

To display a dynamic coverage badge in your README:

#### a) Create a GitHub Personal Access Token (PAT)
1. Go to: `GitHub Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)`
2. Click `Generate new token (classic)`
3. Name: "Haven Gist Token"
4. Scopes: Select `gist` (only this scope)
5. Click `Generate token`
6. **Copy the token** (you won't see it again!)

#### b) Create a Gist for the Badge
1. Go to https://gist.github.com
2. Create a new **secret gist**
3. Filename: `haven-coverage.json`
4. Content: `{}`
5. Click `Create secret gist`
6. **Copy the Gist ID** from the URL (e.g., `https://gist.github.com/username/abc123def456` → ID is `abc123def456`)

#### c) Add Secrets to GitHub
1. Navigate to: `Settings` → `Secrets and variables` → `Actions`
2. Add two secrets:
   - Name: `GIST_TOKEN`, Value: Your PAT from step 2a
   - Name: `GIST_ID`, Value: Your Gist ID from step 2b

### 3. Branch Protection Rules

Configure branch protection to require passing tests before merging:

1. Navigate to: `Settings` → `Branches`
2. Click `Add branch protection rule`
3. Branch name pattern: `main`
4. Configure the following:

**Required Checks**:
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- Select required checks:
  - `Run Tests & Coverage`
  - `Code Quality`
  - `Security Scan`
  - `Review Dependencies`

**Additional Settings**:
- ✅ Require a pull request before merging
- ✅ Require approvals: 1 (optional, remove if working solo)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

5. Click `Create` to save the rule

### 4. Enable GitHub Actions

1. Navigate to: `Settings` → `Actions` → `General`
2. Under "Actions permissions":
   - Select: ✅ Allow all actions and reusable workflows
3. Under "Workflow permissions":
   - Select: ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests
4. Click `Save`

## 📊 Workflows Included

### 1. **ci.yml** - Main CI/CD Pipeline
**Triggers**: 
- Pull requests to `main`
- Pushes to `main` and `Dev`

**Jobs**:
- `test`: Runs pytest with PostgreSQL + Redis services
  - Installs dependencies
  - Runs tests with coverage
  - Uploads coverage to Codecov
  - Comments coverage report on PRs
- `lint`: Code quality checks (Black, isort, Flake8)
- `security`: Security scanning (Safety, Bandit)

### 2. **coverage-badge.yml** - Coverage Badge Updates
**Triggers**: 
- Pushes to `main` branch

**Jobs**:
- Runs tests and generates coverage report
- Updates dynamic coverage badge in Gist
- Requires: `GIST_TOKEN` and `GIST_ID` secrets

### 3. **dependency-review.yml** - Dependency Security
**Triggers**: 
- Pull requests to `main`

**Jobs**:
- Reviews dependency changes for vulnerabilities
- Comments on PRs with security findings

### 4. **pr-labeler.yml** - Auto PR Labeling
**Triggers**: 
- New pull requests
- PR synchronizations

**Jobs**:
- Labels PRs by size (XS/S/M/L/XL)
- Labels by changed files (backend/frontend/tests/etc.)

### 5. **stale.yml** - Stale Issue Management
**Triggers**: 
- Daily at midnight UTC

**Jobs**:
- Marks inactive issues/PRs as stale (30 days)
- Auto-closes after 7 more days of inactivity

## 🧪 Testing the Setup

### Test the CI Pipeline

1. Create a test branch:
```bash
git checkout -b test/ci-pipeline
```

2. Make a small change (e.g., update a comment in code)

3. Commit and push:
```bash
git add .
git commit -m "test: CI pipeline verification"
git push origin test/ci-pipeline
```

4. Create a Pull Request to `main` branch

5. Verify in the PR:
   - ✅ All status checks appear
   - ✅ Tests run successfully
   - ✅ Coverage report is commented
   - ✅ Labels are automatically applied
   - ✅ "Merge" button is disabled until checks pass

### Verify Codecov Integration

1. Go to https://codecov.io/gh/AmanJain2903/Haven
2. Check that coverage data appears
3. Verify the coverage badge works in README

## 🎯 Expected Behavior

### On Pull Request to `main`:
1. **Immediate**:
   - Labels applied (size, file types)
   - All CI workflows triggered
   
2. **During Execution** (~2-3 minutes):
   - Tests run with PostgreSQL
   - Linting checks code style
   - Security scans for vulnerabilities
   - Dependency review checks for issues
   
3. **On Completion**:
   - ✅ Green checkmarks if all pass
   - ❌ Red X if any fail
   - 💬 Coverage report commented on PR
   - 🚫 Merge button disabled if tests fail

### On Merge to `main`:
1. All CI workflows re-run
2. Coverage badge updates (if configured)
3. Codecov statistics updated

## 🔧 Troubleshooting

### Tests Not Running
- Check: `Settings` → `Actions` → Ensure workflows are enabled
- Verify: `.github/workflows/ci.yml` exists in repository
- Check: GitHub Actions tab for error messages

### Coverage Not Uploading
- Verify: `CODECOV_TOKEN` secret is set correctly
- Check: Codecov logs in Actions output
- Ensure: `codecov.yml` is in repository root

### Branch Protection Not Working
- Verify: Status check names match exactly
- Wait: First run must complete for checks to appear in settings
- Check: You have admin access to repository

### Badge Not Updating
- Verify: `GIST_TOKEN` and `GIST_ID` secrets are correct
- Check: Token has `gist` scope
- Ensure: Gist is secret, not public

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Codecov Documentation](https://docs.codecov.io)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [pytest Documentation](https://docs.pytest.org)

## 🤝 Need Help?

If you encounter issues:
1. Check the [GitHub Actions tab](https://github.com/AmanJain2903/Haven/actions) for detailed logs
2. Review workflow YAML syntax
3. Verify all secrets are configured correctly
4. Open an issue with the error message and workflow run link

---

**✅ Setup Complete!** Your CI/CD pipeline is now configured for automated testing and quality control.
