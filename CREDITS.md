# Credits

## Assets

All of Flying Tesla's visuals and sounds are original and generated in code. There are no
downloaded 3D models, textures, HDRIs, fonts or audio files.

- **Car**: built procedurally from extrusions and lathes in `src/scene/car/`. It is an original
  low wedge coupe with no Tesla logos, wordmarks, badges or copied design details.
- **Sky, ground, desert and reflections**: shaders and in-scene light panels (`src/scene/environment/`).
- **Carbon-fibre texture**: drawn on a canvas at runtime.
- **Sound**: synthesised with the Web Audio API (`src/audio/engine.ts`): filtered noise for the gas
  hiss and tire squeal, oscillators for the fan whine and motor.
- **Fonts**: your system's UI and monospace fonts.

If a future contribution adds an HDRI or texture, it must be CC0 (e.g. from Poly Haven) and be
credited here.

## Open-source libraries

| Library                                                                                                                       | Licence                     |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| [three.js](https://threejs.org/)                                                                                              | MIT                         |
| [React](https://react.dev/)                                                                                                   | MIT                         |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber)                                                             | MIT                         |
| [@react-three/drei](https://github.com/pmndrs/drei)                                                                           | MIT                         |
| [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing)                                                 | MIT                         |
| [postprocessing](https://github.com/pmndrs/postprocessing)                                                                    | Zlib                        |
| [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`)                                                                    | Apache-2.0                  |
| [Zustand](https://github.com/pmndrs/zustand)                                                                                  | MIT                         |
| [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), TypeScript, ESLint, Prettier | MIT / Apache-2.0 (dev only) |

## Facts and physics

Reporting on the reveal comes from the outlets listed in [`docs/SOURCES.md`](docs/SOURCES.md).
The physics follows standard textbook relations; NASA Glenn Research Center's educational pages
on isentropic flow, choking and rocket thrust are cited there too. CellCog's independent
estimates were used as a cross-check.
