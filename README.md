# Tower Rush

A standalone 3D tower obstacle game. All runtime files are local; no build,
account, proxy server, or CDN is required. Serve this directory using any static
web host. Three.js 0.170.0 is vendored under its included MIT license.

WASD/arrows move relative to the camera. Space jumps. Drag to look, scroll to
zoom, or Q/E to orbit. R restarts; Escape/P pauses. Touch controls are included.
Classic mode resets falls to the lobby; Practice saves each section. The timer
is eight minutes, with six sections and 48 platforms. Pink bars are hazards.
Best times are saved per mode in browser storage when available.

GitHub Pages: select the `tower-rush-site` branch, `/ (root)`, under the
repository's Settings → Pages → Deploy from a branch. This source uses relative
asset links, so it supports the `/v5/` project path. `.nojekyll` avoids a build.

Tests: from the parent repository, run `node --test tests/tower-physics.test.js`.
Modern WebGL and JavaScript module support are required.
