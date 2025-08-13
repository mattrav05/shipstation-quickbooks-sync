# Claude Code Configuration

This file helps Claude Code understand the development environment and available tools.

## Installed CLIs and Tools

### Version Control
- **Git**: Installed (v2.43.0)
- **GitHub CLI (gh)**: Installed but needs to be added to PATH
  - Installation location: [Need to locate]
  - To add to PATH: `export PATH=$PATH:/path/to/gh`

### Package Managers
- **npm**: Available via Node.js
- **Node.js**: Installed at `/mnt/c/Program Files/nodejs/`

### Development Tools
- **Python**: Installed at `/mnt/c/Python313/`
- **WSL**: Running on WSL2 (Linux)

## Project-Specific Information

### ShipStation-QuickBooks Sync Project
- **Purpose**: Pull shipment data from ShipStation and generate IIF files for QuickBooks Desktop
- **Deployment**: Vercel (serverless functions)
- **API Credentials**: 
  - ShipStation API Key: b5273708f7e5444b9445d406291e5080
  - ShipStation API Secret: b247eb116fc7497da4c99c1f82566ae3

## Environment Setup Commands

```bash
# Add GitHub CLI to PATH (update path as needed)
export PATH=$PATH:/path/to/github-cli/bin

# Authenticate GitHub CLI
gh auth login

# Create GitHub repo and push
gh repo create shipstation-quickbooks-sync --public
git init
git add .
git commit -m "Initial commit"
git push -u origin main

# Deploy to Vercel
vercel --prod
```

## Common Tasks

### Deploy to GitHub and Vercel
1. Ensure GitHub CLI is in PATH
2. Run `gh auth status` to verify authentication
3. Create repo: `gh repo create [name] --public`
4. Push code: `git push`
5. Connect Vercel to GitHub repo

### Local Development
```bash
npm install
npm run dev
```

## Notes for Claude Code
- Always check for CLI availability before using
- This is a work computer with limited command line access
- Prefer browser-based deployment methods when possible
- All CLIs mentioned here should be assumed available unless noted otherwise