# Family Fun Wheel 🎡

A roulette wheel that picks what the family does next. Take turns flicking the wheel, watch the ball rattle round, and whatever it lands on is the plan.

**▶️ Play it: <https://gjohno3.github.io/family-fun-spin-game-/>**

**📖 Setting it up for your own family? Start here: <https://gjohno3.github.io/family-fun-spin-game-/guide.html>**

It's a web app: no app store and no account. It runs in the phone's browser and can be added to the home screen like a normal app. Everything is saved on that phone.

## How it works

1. **Pick the kind of fun.** *After school & evening* or *Day out*.
2. **Set the filters.** Tap the chips:
   - ☀️ Dry / 🌧️ Rainy: rainy hides anything that needs good weather.
   - 💷 Budget: cycles through any, ££ max, £ max and free only.
   - 🏠 Stay home: only things you can do at home (after school only).
3. **Spin.** Whoever's turn it is flicks the wheel with a finger (a harder flick means a longer spin) or presses **Spin**. Their avatar sits in the middle of the wheel.
4. **Let's do it!** saves it to the scrapbook (📖) and passes the turn to the next player.

### Vetoes

Each player gets one veto a month, shown as red chips by their name, and they come back on the 1st. Anyone can use theirs on anyone's spin. After a veto, the same player spins again. Grown-ups can change the number of vetoes, or hand out a bonus one.

### Special pockets

| Pocket | What happens |
| --- | --- |
| 🎰 **Jackpot** | A thin gold pocket, so it's rare. Lands on a big treat. Any activity can be made a jackpot. |
| ✉️ **Mystery Envelope** | A secret plan a grown-up has added. The kids find out on the day. Grown-ups can peek with the PIN. |
| 👑 **Kid's Choice** | The spinner picks anything on the wheel. |
| 🔁 **Spin Twice** | Spin two more times and do both together. |

Kid's Choice and Spin Twice can be switched off in Settings. Jackpot and Mystery appear on their own when the wheel has jackpot or mystery activities.

### Kids' ideas

Tap 💡 to suggest an idea. It waits for a grown-up to approve it, then goes on the wheel with the kid's avatar in the pocket. When the ball lands on it, they get a "Your idea!" celebration.

### Memories and the scrapbook 📖

About an hour after a "Let's do it!", a banner on the main screen asks how it went. Tap it to:

- add up to 6 photos (pick from the camera roll or take new ones)
- let each player give it 1 to 5 stars
- write each player's "best bit" ("Got 3 strikes in a row")

Didn't end up doing it? Tap **We didn't end up doing it** to take it off the list.

The 📖 button opens the scrapbook:

- **Memories:** every activity, newest first, with polaroid photos, everyone's stars and their best bits. Tap a photo to see it full-size, or **Edit** to change a memory.
- **Hall of Fame:** the top three activities on a podium, the rest of the top ten, and each player's favourite.

When the wheel lands on something you've done before, the result card shows how often you've done it, the stars it got and the last photo. A Mystery Envelope stays secret in the scrapbook until its memory is added.

### Grown-up controls 🔒

The first time, you set a 4-digit PIN. Then you can:

- switch activities on and off, edit them and add new ones
- approve or turn down the kids' ideas
- rename players and change their avatars, colours, vetoes and whose turn it is
- copy a backup of everything, or restore one
- spin again without using a veto (from the result card), for when somewhere turns out to be closed

The starter list has the family's own activities switched on, plus a set of suggested places near Exeter that are switched off. Switch on the ones you like. Check opening times before you go, as some places close or cut their hours in winter.

**Forgotten the PIN?** Add `#reset-pin` to the end of the app's address, open it, and you can remove the PIN. Your activities and history are kept.

## Putting it on your phone

The app is hosted for free with GitHub Pages:

**<https://gjohno3.github.io/family-fun-spin-game-/>**

To switch this on (once): in the repo, go to **Settings → Pages**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, and save. A minute later the app is live at the address above. Every change pushed to `main` goes live the same way.

Open that address on the phone, then add it to the home screen:

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap ⋮, then **Add to Home screen** or **Install app**.

It opens full-screen and works offline once it has loaded.

### Your data

Players, activities, ideas and memories are saved in the browser on that device. They don't sync between phones. Use **Grown-ups → Settings → Copy backup** now and then and keep the text somewhere safe. Paste it into **Restore from backup** to bring everything back or to move to a new phone.

Scrapbook photos are stored on the phone separately, as small copies (about 200KB each). They aren't part of the copy-and-paste backup, so after moving phones the memories come back with a placeholder where each photo was. Photos picked from the camera roll are still in the camera roll, of course.

## Running it on a computer

The app uses JavaScript modules, so it needs a small web server rather than opening `index.html` directly:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Tests cover the game logic (filters, pockets, odds, vetoes and turns), saved-data upgrades, and the memory rules (stars, the Hall of Fame and favourites). They need Node 18 or newer and nothing else:

```sh
npm test
```

## How it's built

Plain HTML, CSS and JavaScript with no build step and no dependencies.

| File | What it does |
| --- | --- |
| `index.html` | The page |
| `css/styles.css` | The roulette-table look |
| `js/app.js` | Screens, turns, results, vetoes, ideas, the scrapbook and grown-up controls |
| `js/wheel.js` | Draws the wheel, runs the ball physics and handles flick-to-spin |
| `js/logic.js` | The rules: filters, pockets, picking and vetoes (no page code, so it's testable) |
| `js/memories.js` | Stars, the "how was it?" list, the Hall of Fame and favourites (also testable) |
| `js/photos.js` | Shrinks photos and keeps them in the browser's IndexedDB |
| `js/data.js` | The starter activities |
| `js/state.js` | Saving, loading and backups |
| `js/sound.js` | Sound effects, made with Web Audio (no audio files) |
| `js/confetti.js` | Confetti |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen install and offline support |

The result is picked fairly (weighted by pocket size, using the browser's secure random numbers) before the ball is thrown. The animation then steers the ball into that pocket.

## Ideas for later

- **Fairer odds:** activities you haven't done for ages get bigger pockets, and the star ratings feed in too.
- **Photo backup:** save a backup file that includes the scrapbook photos.
- **Family goals:** team challenges like "5 outdoor activities this month", with points to unlock wheel themes and sounds.
- **Sync** between phones.
- **Shake to spin.**
