# Knock Off Party Pack

A Jackbox-style pack of party games that runs entirely in the browser: a static site with no build step and no game server. Like Jackbox, one **host screen** on a PC shows the game (stream it on Discord or Twitch, or put it on a TV), and everyone plays with their phone as a controller, from anywhere. The first player to join is the **VIP**, who picks the game and moves things along from their phone.

The host screen's browser runs the game. Phones connect straight to it, peer-to-peer over WebRTC with [PeerJS](https://peerjs.com/); PeerJS's free public server only introduces them using the room code. So the whole thing can live on any static host, like GitHub Pages.

Each player picks a **color** and makes an **ASCII face** of up to 3 characters (`:)`, `>.>`, `\o/`, `^_^`…), which together are their icon everywhere: in the lobby, on the scoreboard, and as their egg in Match to Hatch.

The look is **Frutiger Aero**, with soft, wispy waves of light drifting across a deep-to-sky blue gradient behind everything. Each wave is a glowing white edge with a faint translucent sheet on one side; where waves overlap, the sheets stack into lighter bands, and since every wave slides at its own speed and direction and gently rises and falls, the bands keep swelling, thinning and crossing. In front of it are frosted-glass cards, aqua and green gel buttons, and players as glossy orbs. The waves are drawn in code as SVG (`WAVES` in `common.js` sets each one's height, swell, speed and direction). Each is twice as wide as the screen and repeats halfway across, so it loops with no seam, and its blur is drawn once and then only moved, so it stays smooth on phones. Themes recolor the whole scene by turning its hues (amber and pink for Match to Hatch, red when you miss, violet on the scoreboard, dimmer at night...), blending over a second and a half; they're the `filter` rules near the top of `style.css`, and each game picks one per screen.

**Hold to change colors:** press and hold anywhere on the background (not on a card, button or text), with the mouse or a finger, and the whole scene slowly turns through the colors for as long as you hold (once around every 6 seconds). Let go where you like it. Each device remembers its own setting, and it adds to the game's themes, so they still change the scene's color, starting from yours. It's `watchHueHold` in `common.js`.

## Play it

- **Host screen:** on the PC, open the site's `host` page (for example `https://copycatworks.github.io/knock-off-party-pack/host`) and stream or share that window. It opens a room and shows the room code and the address phones should open. The stage is laid out at 16:9 and scales to fill the window, so full screen at any size works.
- **Players:** on any phone, anywhere, open the address the host screen shows, enter a name, pick a color, type a face (or keep the random one, or tap one of the ideas), enter the room code, and tap **Join**. Adding `?code=ABCD` to the address fills in the code. Phones remember your name and look for next time.
- **Colors are one per player.** If someone in the room already has your color, you get the next free one.
- **Changing your mind:** in the lobby, **✏️ Change name, color or face** opens your name (which, like on joining, can't be blank or taken by someone else in the room), the colors (other players' colors are crossed out) and the face box. Changes show on the host screen right away.
- **VIP 👑:** the first player to join. Their phone picks the game, starts it, and goes back to the lobby afterwards. If they disconnect, the next connected player stands in.

- **Keep the host screen open:** the game lives in that window. If it's refreshed, it opens the room again under the same code (this can take a few seconds) and phones rejoin on their own, but a game in progress is lost and everyone goes back to the lobby. Opening the host page in a new window makes a new room.
- **Connections:** almost always fine, but a few strict networks (some cellular or work networks) block direct WebRTC connections, and since there's no relay server, a phone on one of those may not get in. Switching that phone between Wi-Fi and mobile data usually helps.

## Run it locally

Serve the folder with any static file server, for example:

```bash
python -m http.server 8138
```

Then open `http://localhost:8138/host.html` for the host screen and `http://localhost:8138` for the phone page. To test without phones, open the phone page in several other tabs; each tab is its own player. It still needs the internet, for PeerJS's server (and the fonts).

## Deploy it

It's plain files, so put the folder on any static host. On GitHub Pages: push this repository to GitHub, then in the repository's **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. The site appears at `https://<account>.github.io/<repository>/` a minute later, and every push to `main` updates it. All paths are relative, so it works from that subfolder.

## How it's organized

| Path | What it does |
|---|---|
| `js/net.js` | Networking over PeerJS: the phone's connection to the host screen (with heartbeats and reconnecting), shaped like a socket.io socket |
| `js/server/` | The game's "server", which runs in the host screen's browser |
| `js/server/index.js` | Opens the room under a PeerJS id made from the room code and answers phones (VIP-only actions are checked here) |
| `js/server/room.js` | `Room`: host screen, players and their looks, VIP, game picking, lobby → playing → results |
| `js/server/games/` | One module per game, plus `index.js`, which lists them and documents the interface |
| `js/server/games/trivia.js` | Trivia: a multiple-choice round, then a free-answer round (placeholder math questions in `trivia-questions.js`) |
| `js/server/games/match.js` | Match to Hatch (prompts in `match-prompts.js`, answer matching in `match-answers.js`) |
| `js/server/games/ego.js` | Ego Check (questions in `ego-questions.js`) |
| `js/server/games/draw.js` | Memory Draw (characters in `draw-prompts.js`) |
| `js/drawing.js` | Memory Draw's drawing format, limits and painting. Shared by the room and the pages |
| `js/looks.js` | Player colors (`COLORS`), face ideas and defaults (`FACES`), and face cleanup (`cleanFace`: printable ASCII only, up to 3 characters). Shared by the room and the pages |
| `host.html`, `js/host.js` | Host screen: room code, lobby, results, and routing to each game's screen |
| `js/screens/` | Host screen UI for each game (same ids as the game modules) |
| `index.html`, `js/app.js` | Phone app shell: join (name, color, face), lobby (the VIP's game picker), your results, and routing to game controls |
| `js/games/` | Phone controls for each game (same ids as the game modules) |
| `js/eggs.js` | Match to Hatch's eggs (in each player's color) and cracks, drawn on the host screen and phones |
| `licenses/` | License for the Fluent Emoji egg outline used by `eggs.js` |
| `js/common.js` | Helpers: avatars, leaderboard, storage, the sky background and its themes, countdown |
| `css/` | `style.css` (the shared Frutiger Aero look: sky, glass cards, gel buttons, glossy orbs), `app.css` (phones), `host.css` (host screen), and one stylesheet per game (`trivia.css`, `match.css`, `ego.css`, `draw.css`) |

## Games

- **Trivia Test** (1+ players): a multiple-choice round, then a free-answer round. Faster correct answers score more. Free answers ignore spacing, capitalization, accents and punctuation, and numbers compare by value ("07" = "7", "1,000" = "1000").
- **Match to Hatch** (2+ players): everyone has an egg in their color. Each round shows a prompt like "Name a round fruit." Every player whose answer matches at least one other player's gets a crack in their egg; an answer nobody else gave gets nothing. Everyone's eggs stay on screen the whole game. Each egg's cracks spread from a single point as one connected network, glowing brighter as they build up. 10 cracks hatches the egg, and the player's face pops out. The game ends after the round where the first eggs hatch, and everyone who hatched then wins.
  - **What counts as a match** (`match-answers.js`): spacing ("ice cream" = "icecream"), case, punctuation, accents, "the"/"a", simple plurals and number words are ignored ("Apples" = "apple", "4" = "four"). Small typos still match ("watermelone"), and so does one answer contained in another ("Lincoln" = "Abraham Lincoln"). Matches chain: if A matches B and B matches C, all three get a crack.
  - **Points** (they only order the final standings): 250 per crack, plus 2,500 for hatching.
  - Add prompts to `PROMPTS` in `match-prompts.js`. The best ones have a few popular answers.
- **Ego Check** (2+ players): three rounds of three questions. Everyone answers, then everyone checks off the other players they think fit, and scores for every player they read right (checked or left unchecked correctly). The reveal shows everyone's answers, which of your guesses were right, and how many players read *you* right.
  1. **Yes or No:** answer a question like "Do you sing in the shower?", then check who said Yes. 100 points per correct read.
  2. **Trivia:** answer a multiple-choice question, then (seeing the right answer) check who got it right. 150 points per correct read, plus 100 for getting the trivia right yourself.
  3. **Pick One:** pick one of three things, then the game names one option somebody picked, and you check who picked it. 200 points per correct read.
  - Answering takes 15 seconds. Guessing takes 10 seconds plus 2.5 per player to check off (12.5 s with 2 players, 27.5 s with 8).
  - Questions are in `ego-questions.js` (trivia answers are listed first; options are shuffled).
- **Memory Draw** (3+ players): draw a famous character from memory (a Pokémon, cartoon character, brand mascot, president or actor) on your phone, then vote on whose drawing is closest. Drawings are anonymous until the results. Anyone can also give drawings they like a 👍 for 25 bonus points each (not your own).
  1. **Head to Head:** players are paired up, and each pair draws the same character (with an odd count, one matchup has three players). Matchups are voted on one at a time by everyone not in them; a 3-player game has a single 3-way matchup that all three vote on, never for themselves. 100 points per vote, plus 250 for the winner (ties both win).
  2. **Everybody Draws:** everyone draws the same character, then everyone votes for the most accurate one (not their own). 150 points per vote, plus 500 for the winner.
  - Drawing takes 80 seconds in round 1 and 90 in round 2, or until everyone taps **I'm done!**. Each finished stroke is sent to the host screen, so running out of time keeps what you drew. Voting takes 10 seconds plus 3 per drawing.
  - The pad has 12 colors (white works as an eraser), 3 brush sizes, undo and clear. Drawings are stored as strokes on a 1000×1000 grid (`drawing.js`), checked and capped by the room.
  - Add characters to `CHARACTERS` in `draw-prompts.js`.

## Adding a game

1. Write `js/server/games/<id>.js` following the interface described in `js/server/games/index.js`, and add it to the list there. `view(playerId)` is what a phone needs; `screenView()` is everything the host screen shows.
2. Write the host screen in `js/screens/<id>.js` (see `screens/index.js`) and the phone controls in `js/games/<id>.js` (see `games/index.js`), add both to their lists, and add a stylesheet (linked from both `index.html` and `host.html`) if needed.
3. Call `room.finish(scores)` when the game ends; the room shows the final standings.

## Design notes

- **The host screen is the only source of truth.** It runs the room (`js/server/`); phones send only inputs. After every change, the room sends the host screen the public view and each player their own view. Other players' answers and the correct answer only arrive with the reveal, so a phone can't peek.
- **Same events as a server:** both sides talk through a socket.io-shaped object (`on`, and `emit` with an optional reply), so the room and the pages don't know they're peer-to-peer. Messages are JSON, sent in chunks when they're big (a round of drawings).
- **No accounts:** nothing is saved anywhere but the devices. Each phone keeps your name, color and face in `localStorage`.
- **Host screen and VIP:** the host screen makes the room and remembers its code for that tab, so a refresh reopens the same code. The VIP is the first player to join; if they disconnect, the next connected player stands in until they come back.
- **Reconnects:** each tab keeps a seat id in `sessionStorage`, so a refreshed phone gets its seat and score back. Both sides send a heartbeat every 2 seconds; a phone that hasn't been heard from for 12 seconds counts as disconnected (and keeps its seat), and a phone that loses the host screen keeps trying to reconnect for about half a minute.
