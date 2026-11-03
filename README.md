# Ocean Adventure — Stage 2

A browser-based underwater side-scrolling arcade game using HTML, CSS, JavaScript and Canvas.

## Run
Open `index.html` in a browser, or use VS Code Live Server.

## Controls
- Left / Right or A / D: move horizontally across the full game screen
- Up / W / Space: swim upward
- Down / S: dive
- P or the pause button: pause/resume

## Gameplay
- Normal star: +10 points
- Golden star: +50 points
- Oxygen tank: restores 30% oxygen
- Sea mine: costs one life
- Oxygen drains over time; reaching zero costs a life and restores a small emergency reserve.

## Deployment
Import this folder into Vercel as a static site. No build command is needed; set the output directory to `.`.

## Character artwork
The diver uses a custom transparent illustrated sprite at `assets/diver-sprite.png`.

## Stage 10: Enemy characters
- Sharks swim in from the right with a gentle vertical movement.
- Jellyfish pulse and drift vertically with animated tentacles.
- Touching a shark or jellyfish costs one life and briefly activates invulnerability.
- Enemy artwork is drawn with Canvas, so no additional image downloads are required.

## Shark artwork refinement
The shark now uses a smoother layered Canvas illustration with gradients, fins, gills, eye highlights, teeth, and an animated tail.

## Stage 11: Treasure and collectibles
- Pearls award 10 points.
- Golden pearls award 30 points.
- Treasure chests award 50 points.
- Oxygen tanks restore up to 30% oxygen.
- Collectibles have custom Canvas artwork, glow and subtle floating animation.

## Stage 12: Sound and audio
- Underwater ambience is synthesized with the Web Audio API (no external audio files required).
- Sound cues play for starting a dive, collecting pearls, golden pearls and treasure chests, oxygen refills, collisions and game over.
- Use the music-note button in the HUD to mute or enable audio.
- Browsers require a user gesture before audio playback; the audio system initializes when the player starts the game or toggles sound.


## Difficulty progression
- The game has 5 difficulty levels.
- Every 100 score points advances the player to the next level.
- Each level increases the scrolling speed and spawns obstacles more frequently.
- The current level is shown in the HUD.


## Level progression and best score
- The game has 5 difficulty levels; every 100 score points advances one level.
- Higher levels increase scrolling speed and make new objects spawn more frequently.
- The current level and best score are displayed in the HUD.
- Best score is saved in browser localStorage and remains available on the same browser/device.


## Protective shield power-up
- A glowing shield pickup appears occasionally during the dive.
- Collecting it activates an 8-second protective shield.
- The shield absorbs one collision with a mine or sea creature without costing a life.
- A glowing ring appears around the diver while the shield is active; the HUD shows the remaining seconds.
- The shield protects against collisions, not oxygen depletion.


## Game-over summary
- The end screen displays final score, best score, highest level reached, distance travelled, and oxygen used.
- A personal-best message appears when the run sets a new record.
- The replay button starts a fresh dive and resets run-specific values while preserving the saved best score.


## Mobile touch controls
- A directional touch pad is shown on compact screens and touch-first devices.
- Press and hold the arrows to swim up, down, left, or right.
- Releasing a button stops that movement; keyboard controls remain available on desktop.


## Responsive layout
The layout adapts the HUD, menu, legend, and touch controls for desktop, tablet, narrow phones, and short landscape screens. The game canvas keeps its 16:9 aspect ratio so the internal game coordinates remain unchanged.


## Testing and input safety
See `GAMEPLAY_TEST_CHECKLIST.md` for desktop and mobile manual test cases. Held movement inputs are cleared when pausing, when the game ends, and when the page loses focus. P/Escape pause toggling ignores repeated keydown events.
