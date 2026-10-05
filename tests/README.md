# Tests

Plain-function logic is tested without a database or a browser. Run each file
from the repo root under Philippine time (the dates matter):

    TZ=Asia/Manila node --experimental-strip-types tests/clientRequests.test.mjs
    TZ=Asia/Manila node --experimental-strip-types tests/clientObs.test.mjs
    TZ=Asia/Manila node --experimental-strip-types tests/toolsRepo.test.mjs
    TZ=Asia/Manila node tests/monthBoundaries.js     # prints old vs new month ranges

Each prints PASS/FAIL per check and ALL PASSED at the end. Needs Node 22+.
What these do NOT cover: the API routes and screens (they need a live
Supabase) -- those are tested by hand; see PROJECT_KNOWLEDGE.md.
