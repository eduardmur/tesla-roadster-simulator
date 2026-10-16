# Credits

## Assets

All of the simulator's visuals and sounds are original and generated in code. There are no
downloaded 3D models, textures, HDRIs, fonts or audio files.

- **Car**: a body lofted from cross-sections in `src/scene/car/body.ts`. It is an original low
  coupe shape with no Tesla logos, wordmarks, badges or copied design details.
- **Ramp, night sky, ground, lights and reflections**: shaders, simple geometry and in-scene light
  panels (`src/scene/environment/`).
- **Sound**: synthesised with the Web Audio API (`src/audio/engine.ts`): filtered noise for the gas
  hiss and a low rumble. No tones, so nothing whines.
- **Fonts**: your system's UI font.
- **Diagrams in "How it works"**: hand-written SVG and CSS in `src/article/article.ts`.

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
