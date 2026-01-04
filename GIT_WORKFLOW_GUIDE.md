# Git Workflow Guide - Multi-Client Development

## 🌳 Branch Structure Overview

```
base (main development branch)
├── client/intra-ai/dev      (your testing environment)
├── client/intra-ai/prod     (your production)
├── client/contiss/dev       (contiss testing environment)
└── client/contiss/prod      (contiss production)
```

### Branch Purposes

| Branch | Purpose | Deploy To | Push Frequency |
|--------|---------|-----------|----------------|
| `base` | Core feature development | None | After testing on client/dev |
| `client/intra-ai/dev` | Intra-AI testing + customizations | Dev server | Every feature |
| `client/intra-ai/prod` | Intra-AI production | Production server | Weekly/stable releases |
| `client/contiss/dev` | Contiss testing + customizations | Contiss dev server | After base sync |
| `client/contiss/prod` | Contiss production | Contiss production | Monthly/stable releases |

---

## 📋 Complete Development Workflows

### Workflow 1: Developing a New Feature

**Scenario:** You want to add a new feature that all clients will use.

```bash
# 1. Start from base branch
git checkout base
git pull origin base

# 2. Develop your feature
# ... make code changes ...
git add .
git commit -m "feat: add new awesome feature"
git push origin base

# 3. Test on your client first (intra-ai)
git checkout client/intra-ai/dev
git pull origin client/intra-ai/dev
git merge base
# Test locally, make sure everything works
git push origin client/intra-ai/dev
# Deploy to your dev environment and test

# 4. If working well, apply to other clients
git checkout client/contiss/dev
git pull origin client/contiss/dev
git merge base
# Resolve any conflicts with contiss customizations
git push origin client/contiss/dev
# Deploy to contiss dev environment
```

**Tell Copilot:**
> "I developed a new feature. I'm on base branch. Merge it to client/intra-ai/dev, then to client/contiss/dev"

---

### Workflow 2: Client-Specific Customization

**Scenario:** Contiss wants different branding colors, logos, or domain.

```bash
# 1. Work directly on client branch
git checkout client/contiss/dev
git pull origin client/contiss/dev

# 2. Make customizations
# Edit deploy-compose.yml, colors, logos, etc.
git add .
git commit -m "feat(contiss): custom branding and domain"
git push origin client/contiss/dev
# Deploy to contiss dev environment

# 3. Do NOT merge these changes back to base!
# Base should never have client-specific configs
```

**Tell Copilot:**
> "Add contiss branding to client/contiss/dev. Don't merge to base."

---

### Workflow 3: Bug Fix in Production

**Scenario:** Bug found in production, needs immediate fix.

```bash
# 1. Fix on base (so all clients get it)
git checkout base
git pull origin base

# Fix the bug
git add .
git commit -m "fix: resolve critical login bug"
git push origin base

# 2. Fast-track to your production
git checkout client/intra-ai/dev
git merge base
# Quick test
git push origin client/intra-ai/dev

git checkout client/intra-ai/prod
git merge client/intra-ai/dev
git push origin client/intra-ai/prod
# Deploy to production immediately

# 3. Apply to contiss when ready
git checkout client/contiss/dev
git merge base
git push origin client/contiss/dev
# Test on contiss dev, then promote to prod later
```

**Tell Copilot:**
> "Critical bug fix. Merge from base to client/intra-ai/dev, then to prod. Also merge to client/contiss/dev"

---

### Workflow 4: Deploying to Production

**Scenario:** Your dev environment is stable, ready for production.

```bash
# 1. Ensure dev is fully tested
git checkout client/intra-ai/dev
git pull origin client/intra-ai/dev
# Run all tests, verify everything works

# 2. Merge to production
git checkout client/intra-ai/prod
git pull origin client/intra-ai/prod
git merge client/intra-ai/dev
git push origin client/intra-ai/prod

# 3. Tag the release (optional but recommended)
git tag -a intra-ai-v1.0.5 -m "Release 1.0.5 - Feature X and Bug Y fixed"
git push origin intra-ai-v1.0.5

# 4. Deploy from prod branch
# Your CD pipeline or manual deployment
```

**Tell Copilot:**
> "Promote client/intra-ai/dev to prod and tag it as v1.0.5"

---

### Workflow 5: Complex Feature (Needs Testing)

**Scenario:** Big feature that needs extensive testing before going to base.

```bash
# 1. Create temporary feature branch from base
git checkout base
git pull origin base
git checkout -b feature/complex-feature

# 2. Develop the feature
# ... lots of changes ...
git add .
git commit -m "feat: implement complex feature"
git push origin feature/complex-feature

# 3. Test on intra-ai WITHOUT merging to base yet
git checkout client/intra-ai/dev
git merge feature/complex-feature
git push origin client/intra-ai/dev
# Deploy and test extensively on dev

# 4. Once stable, merge to base
git checkout base
git merge feature/complex-feature
git push origin base

# 5. Clean up feature branch
git branch -d feature/complex-feature
git push origin --delete feature/complex-feature

# 6. Now propagate to other clients
git checkout client/contiss/dev
git merge base
git push origin client/contiss/dev
```

**Tell Copilot:**
> "Create feature/complex-feature from base, then merge to client/intra-ai/dev for testing"

---

## 🎯 Quick Command Reference

### Daily Development Commands

```bash
# Check current branch
git branch

# Switch branches
git checkout base
git checkout client/intra-ai/dev
git checkout client/contiss/dev

# Update current branch
git pull origin <current-branch>

# Push changes
git push origin <current-branch>

# See what changed
git status
git diff

# Merge base into client branch
git checkout client/intra-ai/dev
git merge base

# Stash changes temporarily
git stash
git stash pop
```

---

## 🚨 Important Rules

### ✅ DO:
- ✅ Always develop core features on `base` first
- ✅ Test on `client/intra-ai/dev` before applying to other clients
- ✅ Keep client-specific configs ONLY on client branches
- ✅ Merge `base` → `client/dev` → `client/prod` (one direction)
- ✅ Pull before push to avoid conflicts
- ✅ Use descriptive commit messages: `feat:`, `fix:`, `chore:`

### ❌ DON'T:
- ❌ Never merge client branches back to `base`
- ❌ Never put client-specific configs (domains, logos) in `base`
- ❌ Don't develop directly on `prod` branches
- ❌ Don't merge `client/intra-ai/dev` → `client/contiss/dev` (always via base)
- ❌ Don't skip testing on dev before deploying to prod

---

## 🗂️ File Organization for Customizations

To avoid merge conflicts, keep client-specific files separate:

### Client-Specific Files (Only on client branches):
```
deploy-compose.yml              # Domain and deployment config
client/public/assets/logo.svg   # Client logo
librechat.yaml                  # Client-specific settings
.env.example                    # Environment variables
```

### Shared Files (On base branch):
```
Everything else - core code, features, bug fixes
```

---

## 🔄 Conflict Resolution

If you get merge conflicts:

```bash
# 1. See which files have conflicts
git status

# 2. For client-specific files, keep client version
git checkout --ours deploy-compose.yml   # Keep current branch
# or
git checkout --theirs deploy-compose.yml # Keep incoming branch

# 3. For code files, manually resolve
# Open the file, fix conflicts between <<<< and >>>>

# 4. Complete the merge
git add .
git commit -m "merge: resolve conflicts from base"
git push
```

**Tell Copilot:**
> "I have merge conflicts. Keep the client version of deploy-compose.yml, resolve others automatically"

---

## 📞 Copilot Cheat Sheet

### Quick Commands to Tell Copilot

| What You Want | Tell Copilot |
|---------------|--------------|
| New feature | "Develop new feature on base, test on intra-ai dev" |
| Bug fix | "Fix bug on base, merge to all client dev branches" |
| Client customization | "Add contiss config to client/contiss/dev only" |
| Deploy to prod | "Promote client/intra-ai/dev to prod" |
| Sync branches | "Merge base to all client dev branches" |
| Check status | "Show me current branch and uncommitted changes" |
| Resolve conflicts | "Resolve merge conflicts, prefer client version for configs" |

---

## 📊 Visual Workflow Diagram

```
┌──────────────────────────────────────────────────────────┐
│  Developer makes changes                                 │
└───────────────┬──────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│  Commit to: base                                          │
│  "Core features and bug fixes"                            │
└───────────────┬───────────────────────────────────────────┘
                │
                ├──────────────────┬────────────────────────┐
                ▼                  ▼                        ▼
┌────────────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│  client/intra-ai/dev   │  │  client/contiss/dev│  │  Future clients  │
│  + customizations      │  │  + customizations  │  │  + customizations│
└────────┬───────────────┘  └──────┬─────────────┘  └────────┬─────────┘
         │                          │                          │
         │ Test & Verify            │ Test & Verify            │
         ▼                          ▼                          ▼
┌────────────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│  client/intra-ai/prod  │  │  client/contiss/prod│  │  Future clients  │
│  🚀 PRODUCTION         │  │  🚀 PRODUCTION      │  │  🚀 PRODUCTION   │
└────────────────────────┘  └────────────────────┘  └──────────────────┘
```

---

## 🏷️ Commit Message Conventions

```bash
feat:       # New feature
fix:        # Bug fix
chore:      # Maintenance (dependencies, cleanup)
docs:       # Documentation
refactor:   # Code restructuring
style:      # Formatting, no logic change
test:       # Adding tests
perf:       # Performance improvement

# Examples:
git commit -m "feat: add user profile page"
git commit -m "fix: resolve login timeout issue"
git commit -m "feat(contiss): custom domain configuration"
git commit -m "chore: update dependencies"
```

---

## 🎓 Learning Resources

- **Check branch status**: `git log --oneline --graph --all --decorate -10`
- **See differences**: `git diff base..client/intra-ai/dev`
- **Undo last commit**: `git reset --soft HEAD~1`
- **Discard changes**: `git checkout -- <file>`

---

## 🆘 Emergency Procedures

### "I committed to the wrong branch!"

```bash
# 1. Note the commit hash
git log -1
# Copy the commit hash (e.g., abc1234)

# 2. Switch to correct branch
git checkout <correct-branch>

# 3. Cherry-pick the commit
git cherry-pick abc1234

# 4. Go back and remove from wrong branch
git checkout <wrong-branch>
git reset --hard HEAD~1
git push origin <wrong-branch> --force
```

### "I accidentally pushed client config to base!"

```bash
# 1. Revert the commit on base
git checkout base
git revert <commit-hash>
git push origin base

# 2. Merge base to clients again
git checkout client/intra-ai/dev
git merge base
git push origin client/intra-ai/dev
```

### "Everything is broken, help!"

```bash
# See what changed
git status
git log -5

# Discard all local changes
git reset --hard origin/<current-branch>

# Or start fresh
git fetch origin
git checkout -B <branch> origin/<branch>
```

**Tell Copilot:**
> "Emergency: I need to undo my last commit / reset to remote / cherry-pick a commit"

---

## ✅ Checklist Before Deploying to Production

- [ ] All features tested on dev environment
- [ ] No console errors
- [ ] Database migrations run successfully
- [ ] Environment variables updated
- [ ] Backup created
- [ ] Team notified of deployment
- [ ] Merge client/dev → client/prod
- [ ] Tag the release
- [ ] Deploy
- [ ] Verify production is working
- [ ] Monitor logs for 30 minutes

---

## 📝 Current Branch State (as of setup)

```
✓ base                    - Synced with intra-ai/dev, up to date
✓ client/intra-ai/dev     - Active development branch (YOUR MAIN BRANCH)
✓ client/intra-ai/prod    - Production ready
✓ client/contiss/dev      - Created with contiss.intra-ai.de domain
✓ client/contiss/prod     - Created, ready for first deployment
```

All branches pushed to GitHub ✅

---

**Last Updated:** January 4, 2026  
**Maintained by:** Intra-AI Development Team  
**Questions?** Ask GitHub Copilot with specific scenarios from this guide.
