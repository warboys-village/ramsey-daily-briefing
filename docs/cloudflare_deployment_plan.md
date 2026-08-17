# Implementation Plan: GitHub Actions & Cloudflare Deployment Strategy

Clarify Cloudflare secret requirements for GitHub Actions and optimize `.github/workflows/daily-briefing.yml` for zero-secret Git-driven deployment.

---

## 🎯 Direct Answer to User Question

> **Short Answer: NO, you do NOT need a Cloudflare API Key in GitHub Actions!**

### Why?
1. **Cloudflare Pages is connected to your GitHub repository**:
   Cloudflare automatically listens for git commits on the `main` branch of `warboys-village/daily-briefing`.
2. **Automated Daily Trigger Flow**:
   - Every morning at 06:00 UTC, GitHub Actions runs `npm run ingest` using `secrets.LLM_API_KEY` (free Gemini API key).
   - GitHub Actions commits the newly generated daily briefing (`src/briefings/YYYY-MM-DD.md`) back to `main`.
   - **Cloudflare Pages automatically detects the git push** and builds/deploys the site live to **[https://daily.warboys.uk](https://daily.warboys.uk)**.

---

## 🛠️ Proposed Workflow Optimization

### [MODIFY] `.github/workflows/daily-briefing.yml`
Remove the explicit `cloudflare/pages-action@v1` step from `.github/workflows/daily-briefing.yml` so that GitHub Actions completes cleanly without requiring `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` secrets:

```diff
-      - name: Deploy to Cloudflare Pages
-        uses: cloudflare/pages-action@v1
-        with:
-          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
-          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
-          projectName: 'warboys-daily-briefing'
-          directory: '_site'
-          gitToPages: false
```

### Summary of GitHub Secrets Needed
| Secret Name | Required? | Notes |
| :--- | :--- | :--- |
| `LLM_API_KEY` | **YES** | Free Gemini 2.0 Flash API key from Google AI Studio. |
| `CLOUDFLARE_API_TOKEN` | **NO** | Not needed when Cloudflare Pages is connected to GitHub. |
| `CLOUDFLARE_ACCOUNT_ID` | **NO** | Not needed when Cloudflare Pages is connected to GitHub. |

---

## 🧪 Verification Plan

### 1. Manual Workflow Dispatch Test
Trigger GitHub Action manually from GitHub Actions UI or via CLI:
```bash
gh workflow run daily-briefing.yml
```
Confirm workflow completes with green checkmark without requesting Cloudflare tokens.
