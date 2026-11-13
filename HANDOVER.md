# Handing over / moving this project

Everything needed to run WebXR Classes is in this repository. There is no build step, no database, no server of
our own, no passwords or API keys, and no account tied to the code. It can be moved to another GitHub account
or organisation (e.g. a school's or company's) or another computer, and it keeps working without code changes.

## What you need

- A copy of this repository (with its history, ideally).
- Somewhere that serves static files over **HTTPS** (WebXR requires it). GitHub Pages is free and already set up.

## Option A: transfer the GitHub repository (keeps history, issues and settings)

1. On GitHub: **Settings → General → Danger Zone → Transfer ownership**, and choose the new account or organisation.
2. In the new location: **Settings → Pages → Source: GitHub Actions**. The workflow in
   `.github/workflows/pages.yml` deploys every push to `main`.
3. The site address becomes `https://<new-owner>.github.io/webxr-classes/`. GitHub redirects the old
   *repository* address, but **not** the old Pages site, so share the new link (and bookmark it on the headsets).

## Option B: copy to a new repository, or to another computer

```bash
git clone --mirror https://github.com/<old-owner>/webxr-classes.git
cd webxr-classes.git
git push --mirror https://github.com/<new-owner>/webxr-classes.git
```

Then turn on Pages as in A.2. Without git, **Code → Download ZIP** on GitHub gives every file (no history); upload
the files to the new repository.

To run on a computer without GitHub: serve the folder with any static web server (see *Running it* in the README).

## Nothing to edit in the code

- All links inside the project are relative, so it works under any address.
- Shared sessions keep working across the move: devices just need to open the lessons from the same address.
- The only settings files: `shared/net/config.js` (networking), and each lesson’s `config.js` (optional AI expert
  servers, all off by default).

## Outside services it relies on (all free, no account)

| What | Used for | Where it's set |
| --- | --- | --- |
| `cdn.jsdelivr.net` | three.js (3D engine) and the 3D-model decoders | the `importmap` in each lesson's `index.html` |
| Nostr relays `nos.lol`, `relay.primal.net`, `nostr.mom` | introducing devices in a shared session | `shared/net/config.js` |
| STUN servers (Google, Cloudflare) | checking devices are on the same network; connecting them | `shared/net/config.js` |
| GitHub Pages | hosting | `.github/workflows/pages.yml` |

## Licences: check before using commercially

The project's own code has **no licence file yet**: the owner should choose one (for company property, usually
"All rights reserved" / proprietary). Third-party parts:

| Part | Licence | Commercial use |
| --- | --- | --- |
| three.js, three-mesh-bvh, Trystero (`shared/vendor/TRYSTERO-LICENSE`) | MIT | yes, keep the licence notices |
| Hintze Hall scan, most Reef Dive models | CC BY 4.0 | yes, keep the credits in the `CREDITS.md` files |
| Some Reef Dive models | CC0 | yes |
| **Heart Lab heart model** (`lessons/heart-lab/models/heart.glb`, `heart.json`) | CC BY-SA 2.1 Japan (BodyParts3D) | yes, keep the credit in its `CREDITS.md`; changes to these two files stay under the same licence |
| Acid Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Waves Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Bounce Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Radiation Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Microscope Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Enzyme Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Osmosis Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Heart Lab sounds, blood flow, ECG, backup heart | made in code for this project | yes (it is the project’s own) |
| **Reef Dive hammerhead** (`hammer.glb`) | CC BY-NC 4.0 | **no**: replace it before any commercial use |
| **Reef Dive manta ray** (`manta.glb`) | CC BY-NC-SA 4.0 | **no**: replace it before any commercial use |
| **Reef Dive parrotfish** (`parrotfish.glb`) | Sketchfab Standard, used with the owner's permission | get that permission confirmed for the new owner, or replace it |

Full sources: `lessons/reef-dive/models/CREDITS.md` and `lessons/hintze-hall/models/CREDITS.md`.

## Rule for all future changes

Keep the project self-contained and portable:

- no hard-coded account names, personal addresses or absolute links to one GitHub account;
- no secrets in the repository (it is served publicly);
- every new model, texture or sound gets its source and licence recorded in a `CREDITS.md` beside it;
- any new outside service is added to the table above.
