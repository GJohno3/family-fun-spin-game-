# Family Fun Wheel 🎡

A roulette wheel that picks what the family does next. Take turns flicking the wheel, watch the ball rattle round, and whatever it lands on is the plan.

It's a web app: no app store and no account. It runs in the phone's browser and can be added to the home screen like a normal app. Everything is saved on that phone.

## How it works

1. **Pick the kind of fun.** *After school & evening* or *Day out*.
2. **Set the filters.** Tap the chips:
   - ☀️ Dry / 🌧️ Rainy: rainy hides anything that needs good weather.
   - 💷 Budget: cycles through any, ££ max, £ max and free only.
   - 🏠 Stay home: only things you can do at home (after school only).
3. **Spin.** Whoever's turn it is flicks the wheel with a finger (a harder flick means a longer spin) or presses **Spin**. Their avatar sits in the middle of the wheel.
4. **Let's do it!** saves it to the history (📜) and passes the turn to the next player.

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

The app needs to be hosted somewhere so the phone can open it. Any static hosting works. Two free options:

**GitHub Pages.** This needs the repository to be public on a free GitHub plan (private repos need a paid plan). In the repo, go to **Settings → Pages**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, and save. After a minute the app is at `https://<username>.github.io/family-fun/`.

**Netlify or Cloudflare Pages.** Both can publish a private GitHub repo for free. Connect the repo, leave the build command empty and set the publish directory to `/`.

Then add it to the home screen:

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap ⋮, then **Add to Home screen** or **Install app**.

It opens full-screen and works offline once it has loaded.

### Your data

Players, activities, ideas and history are saved in the browser on that device. They don't sync between phones. Use **Grown-ups → Settings → Copy backup** now and then and keep the text somewhere safe. Paste it into **Restore from backup** to bring everything back or to move to a new phone.

## Running it on a computer

The app uses JavaScript modules, so it needs a small web server rather than opening `index.html` directly:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Tests cover the game logic (filters, pockets, odds, vetoes and turns). They need Node 18 or newer and nothing else:

```sh
npm test
```

## How it's built

Plain HTML, CSS and JavaScript with no build step and no dependencies.

| File | What it does |
| --- | --- |
| `index.html` | The page |
| `css/styles.css` | The roulette-table look |
| `js/app.js` | Screens, turns, results, vetoes, ideas and grown-up controls |
| `js/wheel.js` | Draws the wheel, runs the ball physics and handles flick-to-spin |
| `js/logic.js` | The rules: filters, pockets, picking and vetoes (no page code, so it's testable) |
| `js/data.js` | The starter activities |
| `js/state.js` | Saving, loading and backups |
| `js/sound.js` | Sound effects, made with Web Audio (no audio files) |
| `js/confetti.js` | Confetti |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen install and offline support |

The result is picked fairly (weighted by pocket size, using the browser's secure random numbers) before the ball is thrown. The animation then steers the ball into that pocket.

## Ideas for version 2

- **Memory log:** a photo and star ratings from each kid after every activity, building into a family scrapbook and Hall of Fame.
- **Fairer odds:** activities you haven't done for ages get bigger pockets, and the ratings feed in too.
- **Family goals:** team challenges like "5 outdoor activities this month", with points to unlock wheel themes and sounds.
- **Sync** between phones.
- **Shake to spin.**
