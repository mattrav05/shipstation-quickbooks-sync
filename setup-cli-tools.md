# CLI Tools Setup Guide

This guide helps ensure Claude Code has access to all necessary development tools.

## Required CLI Tools Installation

### 1. GitHub CLI (gh)
```bash
# Option 1: Using winget (Windows 11)
winget install --id GitHub.cli

# Option 2: Download from https://cli.github.com
# Install the Windows version (.msi file)

# After installation, restart your terminal and run:
gh auth login
```

### 2. Vercel CLI (for direct deployment)
```bash
npm install -g vercel
vercel login
```

### 3. Other Useful Tools
```bash
# Node Version Manager (if needed)
npm install -g nvm

# TypeScript (if needed)
npm install -g typescript

# Prettier (code formatting)
npm install -g prettier
```

## Verification Commands

Run these to verify installations work:
```bash
# Check all tools
gh --version
vercel --version
git --version
node --version
npm --version
```

## Global CLAUDE.md Setup

Create this file in your home directory (`C:\Users\15864\CLAUDE.md`):

```markdown
# Global Claude Code Configuration

## Available CLI Tools
- Git: ✓ Installed (v2.43.0)
- GitHub CLI (gh): ✓ Installed 
- Vercel CLI: ✓ Installed
- Node.js/npm: ✓ Installed
- Python: ✓ Installed

## Authentication Status
- GitHub: Authenticated
- Vercel: Authenticated

## Common Commands
- Deploy to GitHub: `gh repo create [name] --public && git push`
- Deploy to Vercel: `vercel --prod`
- Create PR: `gh pr create`

## Project Conventions
- Use TypeScript for new projects
- Deploy to Vercel for web apps
- Use GitHub for version control
- Document APIs in README.md
```

## After Installation

1. Restart your terminal/WSL
2. Run verification commands above
3. Update your global CLAUDE.md file
4. Test with a simple project deployment

This ensures Claude Code can always use these tools in future sessions!