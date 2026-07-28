# Monkey Maze Escape

8-bit temple raid: collect every gem, open the sealed gate, escape the guardian monkey.

## Play

Open `index.html` in a browser.

## Controls

- **WASD** / arrows — move (corner assist enabled)
- **Shift** — sprint
- **Space** — start / restart

## Rules

1. Every corridor is reachable — no softlocks
2. All gems are available before the gate opens
3. The **red-barred gate** is the only path to the exit
4. Bumping the gate shows how many gems you still need
5. The monkey pathfinds and gets faster as you loot

## Project

- `index.html` — shell + HUD
- `style.css` — presentation
- `game.js` — maze, combat AI, juice, audio
