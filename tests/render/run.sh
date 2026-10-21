#!/usr/bin/env bash
# Draws the real Pulse screen and Dashboard in a simulated browser with mock data and clicks the new dropdowns.
# Needs esbuild and jsdom; installs them temporarily (--no-save) so package.json and the lockfile never change.
set -e
cd "$(dirname "$0")/../.."
if [ ! -x node_modules/.bin/esbuild ] || [ ! -d node_modules/jsdom ]; then npm i --no-save --no-audit --no-fund esbuild jsdom; fi
trap 'rm -f components/KPIApp.smoke.tmp.tsx tests/render/out.cjs' EXIT
# a temporary copy of the app file that exports the screens under test (never committed)
sed -e 's/^function PulseCheckPanel(/export function PulseCheckPanel(/' -e 's/^function PerformanceDashboard(/export function PerformanceDashboard(/' \
    -e 's/^const PULSE_CATEGORIES:/export const PULSE_CATEGORIES:/' -e 's/^function getWeekStart(/export function getWeekStart(/' -e 's/^function BCPPanel(/export function BCPPanel(/' \
    components/KPIApp.tsx > components/KPIApp.smoke.tmp.tsx
npx esbuild tests/render/harness.tsx --bundle --platform=node --format=cjs --outfile=tests/render/out.cjs --jsx=automatic --tsconfig=tsconfig.json --packages=external --log-level=error
NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://dummy.supabase.co}" NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-dummy}" TZ=Asia/Manila node tests/render/run.cjs 2>&1 | grep -E "^PASS|^FAIL|PROBLEMS|ALL PASSED|^ - |HARNESS"
