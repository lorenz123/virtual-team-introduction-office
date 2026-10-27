# Virtual Office

A living map of a team: rooms, desks, people, and the things on their desks.
Any team can create its own office, arrange the floor plan, and use it for team introductions or as a team overview.
It runs on your own computer or server. No cloud service, account or AI tool is needed.

## Quick start

You need [Node.js](https://nodejs.org) 16 or newer (free). Nothing else to install.

```
node server.js
```

Open **http://localhost:3000**. You'll see the list of team offices and a form to create a new one.
The **Nationwide Team** office is already set up at **http://localhost:3000/t/nationwide-team**.
(If you start with an empty `data/teams` folder, a sample office is created instead.)

### Let other people in

```
node server.js --share
```

The terminal prints an address such as `http://192.168.1.25:3000`. Anyone on the same network (office Wi-Fi or VPN) can open it.
Allow Node.js through your firewall on private networks only.

To run on a different port: `PORT=8080 node server.js` (Windows PowerShell: `$env:PORT=8080; node server.js`).

## Creating a team office

On the home page, enter a team name and pick a starting point:

| Template | What you get |
|---|---|
| Blank office | A team room, meeting room, lounge and client room. |
| Software delivery team | Rooms for the Scrum Master, analysts, developers, QA and release, plus a client room. |
| Sample team | A filled-in 11-person example you can edit or clear out. |

Each office gets its own link, for example `http://localhost:3000/t/payments-qa`. Share that link with the team.

**Edit code (optional).** Set one when creating the office, or later in Manage team → Backup & access.
With a code, anyone with the link can look around, but only people who enter the code can change things.
Without one, anyone who can open the link can edit.

## Arranging the office

Click **Edit office** (bottom right). Then:

- **Add a room:** use the Add room buttons for a team room, meeting room, lounge, ticket board, client room or open area.
- **Move a room:** drag it by its title bar.
- **Resize a room:** drag the yellow corner handle.
- **Move people:** drag a person's desk into another team room, or to a different spot in the same room.
- **Add decor:** plants, sofas, a coffee machine, water cooler, bookshelf, whiteboard, table tennis, rugs, an arcade machine and more. Drag it into place; click it to recolour or remove it.
- **Edit anything:** click a room's title, a desk or a decor item.
- **Floor width:** Standard, Wide or Extra wide, for bigger teams.

Click **Done editing** (or press Esc) when you're finished. Changes save as you go.

## People and their desks

Add or edit people from the **+** on a team room, the sidebar, a profile screen, or Manage team. Each person has:

- name, role (job title), room, city, country, time zone and status
- **fun facts** (one per line, up to 5) and **about me** (optional)
- a **character**: pick one of 16 starting looks, then open **Customise character** to change the hair, beard, hat
  (cap, straw hat, beanie, bear-ear beanie, motorcycle helmet, headset, headphones), eyewear, outfit (shirt, sweater, hoodie,
  sports jacket, bathrobe, overalls), every colour including skin tone, and extras like a backpack, pitchfork, lipstick,
  tired eyes or extra arms for the team's multitasker
- **up to 6 things on their desk**, each in any colour and with an optional short note. The first 4 are drawn on the desk;
  the profile lists them all
  (for example "Hot chocolate, never coffee"). There are 38 items, including an aquarium, sticky notes, a laughing Buddha figure, mugs, a cup of tea, notebook and pen,
  phone, earbuds, water bottle, coaster, music speaker, microphone, audio gear, guitar, a real cat, plushies,
  a bowl of candy, shells and beach rocks, baby wipes, sports balls, plants, books and more

Click anyone on the floor plan to zoom into their desk. A large profile screen opens with their details on the left
and their fun facts and "about me" on the right. Desks are drawn as large as each room allows; make a room bigger
(Edit office, drag the corner) to get bigger desks.

## Audio presenter

Click **Present the team** (bottom bar) for a guided, spoken tour: a welcome, the client room, then each person in turn,
and a sign-off. The camera moves to each desk as it's introduced, and captions show what's being said.
Use the presenter bar to pause, skip back or forward, stop, pick a voice and change the speed. Keyboard: Space pauses, ← → skip, Esc stops.

On any profile or client card, **▶ Listen** reads just that one.

What gets said:

- **Presenter script** on each person (Edit person). Write it like a host would say it: a few highlights, not every field.
  **Write one from the profile** drafts a script you can edit, and **▶ Preview** plays it.
- Without a script, the presenter writes one from the profile: name, role, where they are and their local time,
  a line from "about me", a fun fact or two, and what's on their desk.
- The client room has its own presenter script (edit the room). The opening and closing are in Manage team → Team settings.

The voices are the ones built into your browser and computer, so nothing is sent anywhere.
Microsoft Edge has the most natural-sounding voices ("Natural" voices need an internet connection). Chrome and Safari work too.

## Team mix

Team mix (below the office) counts people by **category**. Give each role a category in Manage team → Roles
(for example Managers, BA, Developers, QA, Rates, Forms); roles with the same category are counted together, with
everyone's faces underneath. Click a face to open that person. Without categories, Team mix counts each role separately.

## Name and logo

Click the pencil on the top-left tile (or **Manage team → Name & logo**) to set the name, tagline and logo shown at the top of the office,
for example your client's logo. Turn off "White background behind the logo" for light logos on a transparent background.

## Client rooms

A client room presents the client you support. Edit it (pencil on the room in Edit office) to add:

- the client's name, tagline and logo
- up to 10 text fields with your own labels (industry, products you support, main contact, time zone…)
- up to 6 images with optional captions (product screenshots, their office, team photos, diagrams)

Outside edit mode, click the room or **View details** to zoom in to the full client card. Click an image to enlarge it.
Pictures are resized when uploaded and stored inside the team's file, so backups include them.

## Locations and stand-up

The Locations tile lists each country with its head-count and the current local time in each of its time zones.
The stand-up tile shows the next daily stand-up and when it starts in your own time. Set it in Manage team → Team settings.

## Where the data lives

- Each office is one file: `data/teams/<team>.json`. The previous version is kept next to it as `<team>.prev.json.bak`.
- Deleted offices move to `data/trash/` (they can be restored by moving the file back into `data/teams/`).
- **Download backup** / **Restore from backup** in Manage team save or load an office as a single file.
  `nationwide-team-backup.json` (next to this README) is a fresh copy of the Nationwide office, in case you want to start over.

To back everything up, copy the `data` folder.

### Coming from the first local version?

Put your old `team.json` in the `data` folder **before** the first start. It will be imported as an office automatically.
You can also open an office and use **Restore from backup…** with the old file.

## Without the server

Double-click `public/index.html` to open a single office straight from disk.
It's saved in that browser only, and there is no home page, team list or edit code. Use the server for anything shared.

## Good to know

- Fonts load from Google Fonts when you're online. Offline, the page uses your system fonts and still works.
- There are no user accounts. The edit code is the only protection, so keep the server on a network you trust.
- Several people can edit at once; everyone's changes appear on other screens within a few seconds.
