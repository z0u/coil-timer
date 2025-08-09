# Coil Timer - Visual Timer PWA

Coil Timer is a React/TypeScript Progressive Web App (PWA) built with Vite. It's a distraction-free visual timer similar to a pomodoro timer, featuring a unique spiral interface that users wind up by dragging clockwise.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Development Workflow

**Start development server**:

```bash
npm run dev
```

- Starts Vite dev server on `http://localhost:5173/`
- Features hot module reloading
- Ready in ~0.6 seconds

**Preview production build**:

```bash
npm run preview
```

- Serves built files from `dist/` directory
- Available at `http://localhost:4173/coil-timer/`
- Note: Uses `/coil-timer/` base path for GitHub Pages deployment

**Code formatting**:

```bash
npm run format
```

- Formats all files using Prettier
- Takes ~0.5 seconds

**PNG generation** (standalone):

```bash
npm run png
```

- Converts SVG icons to PNG format
- Creates `public/apple-touch-icon.png` and `public/social-preview.png`
- Takes ~0.5 seconds

### Testing and Quality Assurance

**IMPORTANT**: There are NO unit tests in this repository. The `npm run test` command intentionally fails with "Error: no test specified" and exit code 1. Do not attempt to run tests.

**Pre-commit validation**:
Always run these commands before committing changes or the CI will fail:

```bash
npm run lint
npm run format:check
```

## Repository Structure

### Key Directories

- `src/` - React/TypeScript source code
- `public/` - Static assets (icons, manifest, SVGs)
- `dist/` - Build output (created by build process)
- `.github/` - GitHub workflows and configuration

### Important Files

- `src/main.tsx` - Application entry point, renders `SpiralTimer` component
- `src/SpiralTimer.tsx` - Main timer component
- `package.json` - Dependencies and build scripts
- `vite.config.mjs` - Vite configuration with Tailwind CSS
- `index.html` - HTML template with PWA meta tags
- `public/manifest.json` - PWA manifest for mobile installation

### Configuration Files

- `eslint.config.js` - ESLint configuration with TypeScript/React rules
- `.prettierrc.json` - Prettier formatting configuration
- `.gitignore` - Excludes node_modules, dist, generated PNGs

## Technology Stack

**Frontend Framework**: React with TypeScript
**Build Tool**: Vite
**Styling**: TailwindCSS
**Code Quality**: ESLint + Prettier
**Math Libraries**: @thi.ng/math, @thi.ng/vectors for geometric calculations
**Utilities**: clsx (class names), fast-deep-equal, zod (validation)
**Icons**: Lucide React

## CI/CD and Deployment

**GitHub Actions Workflow**: `.github/workflows/build-and-deploy.yml`

- Runs on push to main and PRs
- Installs librsvg, runs lint/format checks, builds, and deploys to GitHub Pages
- **Quality gates**: ESLint and Prettier must pass or deployment fails

**Production deployment**: https://z0u.github.io/coil-timer
**Base path**: Uses `/coil-timer/` for GitHub Pages (configured in vite.config.mjs)

## Common Commands Reference

```bash
# Fresh setup
sudo apt-get update && sudo apt-get install -y librsvg2-bin
npm install

# Development
npm run dev                    # Start dev server
npm run build                  # Build for production (~4 seconds)
npm run preview                # Preview production build

# Code quality
npm run lint                   # Check code with ESLint (~2 seconds)
npm run format                 # Format code with Prettier (~0.5 seconds)
npm run format:check           # Check formatting (~1 second)

# Asset generation
npm run png                    # Generate PNG icons from SVG (~0.5 seconds)
```

## Common Troubleshooting

**Build fails with "rsvg-convert: command not found"**:
Install librsvg: `sudo apt-get update && sudo apt-get install -y librsvg2-bin`

**ESLint or Prettier errors in CI**:
Run `npm run format` then `npm run lint` locally before committing

**Application not loading in preview mode**:
Ensure you're accessing `http://localhost:4173/coil-timer/` (note the base path)

**Timer not starting**:
Check browser console for wake lock messages and JavaScript errors
