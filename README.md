# JOCHU Manufacturing Order System

This project is a React-based application for generating Manufacturing Orders (MO), integrated with Google Apps Script (GAS) as the backend.

## Deployment to GitHub Pages

This project is configured to automatically deploy to GitHub Pages using GitHub Actions.

### Prerequisites

1.  **Repository Secrets**: You need to set up the following secret in your GitHub repository settings:
    *   `VITE_GAS_APP_URL`: The URL of your deployed Google Apps Script Web App.
    *   (Go to Settings > Secrets and variables > Actions > New repository secret)

2.  **GitHub Pages Settings**:
    *   Go to Settings > Pages.
    *   Under "Build and deployment", select **Deploy from a branch**.
    *   Under "Branch", select `gh-pages` and save. (This branch will be created automatically after the first successful action run).

### Workflow

*   On every push to the `main` branch, the GitHub Action defined in `.github/workflows/deploy.yml` will run.
*   It will install dependencies, build the project (injecting the `VITE_GAS_APP_URL`), and deploy the `dist` folder to the `gh-pages` branch.

## Local Development

1.  Copy `.env.example` to `.env`.
2.  Fill in your `VITE_GAS_APP_URL`.
3.  Run `npm install`.
4.  Run `npm run dev`.
