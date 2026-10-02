# Playbook — functional spec (Coach package)

Source: the founder's screen recording `PlaybookAçıklaması.mp4` (6:14, not committed), which walks
through an existing flag-football playbook app. The founder wants **the same logic, file model and
drawing math**, rendered in Atlethera's own design. Transcript: `docs/playbook-video-transcript.txt`.

> "Yani çizim mantığının çok basic akıcı bir şekilde olması lazım." — drawing must feel basic and fluid.

Status: **in progress (2026-09-24).** Order agreed on 2026-09-23: finish the landing page → playbook → Coach
panel → PT panel. Data lives in the browser (localStorage) until a backend is chosen.

## 1. File model

- **Playbook list.** Create, open, rename, duplicate, delete, reorder.
- **New playbook dialog:** name; players per side (4–9, default 5; the founder says the default
  classic flag field is enough); field lines: `30×50`, `30×40`, `5-yard lines`,
  `5-yard lines with yardage`, `none`.
  - Atlethera addition: the playbook's sport comes from the Coach package's chosen sport.
    American Football uses 11 per side and an American football field.
- **Inside a playbook:** two sides — **Offense** (circle icon) and **Defense** (X icon).
- **Categories** per side. Defaults: Offense `Run`, `Pass`; Defense `Base`, `Red Zone`.
  Sidebar shows `All … plays`, each category, `Uncategorized`, each with a count.
  **Edit categories** screen: add by name, reorder, delete (plays keep existing).
  Example from the video: add `End zone` (offense), `Cover 6` (defense).
- **Play cards:** thumbnail of the play, number, name, info button. "New offensive/defensive play" card first.
- **New play dialog:** name, categories (multi-select), optional play notes, a note per position.

## 2. Play

- **Play info:** rename, change categories, **Copy** (duplicate in the same playbook),
  **Copy to** (another playbook), **Delete**, general notes, per-position notes,
  "modified <date> by <user>".
- **Lock:** when locked nothing can be moved or drawn ("Locked — unlock to edit").
- **Field options:**
  - Dark field / Light field
  - Don't snap / Snap to grid
  - Hide opponent / Show opponent — shows the other side's default formation as ghosts, which can be
    repositioned
  - Backfield: Less / Standard / More (how much field shows behind the line of scrimmage)
  - Ball on: +1, +2, +3, +4, No-run (end zone), … (goal-line situations: puts the end zone in view)
- **Flip:** mirror the play left↔right (X and Y swap sides, routes mirror).
- **Annotations / assign positions:** exist in the reference app; the founder says they are optional.
- **Play (animate):** all players run their routes; controls: settings (speed), back to start,
  play/pause, replay, done. Works for offense and defense plays.

## 3. Drawing logic (checked frame by frame against 2:05–3:30 and 3:40–4:52)

Implemented as a pure reducer in `src/domain/playbook/editor.ts`; tests in `playbook.test.ts`.

- **Select:** tap a player. The floating toolbar appears; every other player dims. Tapping
  another player switches the selection. The green check (done) deselects and undims.
- **Move:** press a player and drag. Thin guide lines run across the field through the pointer.
  Its route travels with it.
- **Draw:** with a player selected, tap on the field to add a segment from the end of its route
  (a corner point), or press and drag: the segment follows the pointer and is placed on release.
  Guide lines follow the pointer while drawing. The route is drawn in the player's colour.
- **Red button:** removes the **last segment**, one per press, until the route is empty.
- **Template (offense only):** opens the route tree (1–9 and 66, §5) with a left/right switch.
- **Star:** toggles the player into a star shape.
- **Zigzag:** motion. Only the **first segment** is drawn as a zigzag; the rest is the route
  after the snap. Applies to the existing route and to segments still to come.
- **Dashed:** the whole route dashed.
- **End style:** cycles **arrow → T (block) → small ring (dot) → arrow**; the button shows the
  current one.
- **Corners:** toggles sharp ↔ rounded ("oval"); rounds the existing route at once (radius
  about 2.5 yd).
- **Zone (defense only):** a filled circle in the player's colour where the route ends (or on
  the player); a slider sets the radius (default about 4 yd). It follows the route end.
- **Toolbar:** has a handle to drag it out of the way.
- **Playback:** zones stay put; players run their routes; small markers stay at the start
  spots. Motion runs first; at the snap everyone moves together. Controls: speed, back to
  start, play/pause, replay, done.

## 4. Reference defaults (5v5 flag, 30-yard-wide field, measured from the video)

Offense (own side, y = yards from the line of scrimmage, negative = backfield):
`X (3.9, 0)` · `C (15, 0)` square · `Y (26.1, 0)` · `Z (20.6, −1.75)` · `Q (15, −4.3)`.
Product change (coach feedback, 2026-09-24): Atlethera places Q at −3.3 (a yard closer to the
centre) and American football QB/RB at −4.5, so the fixed full-width board keeps more room for
routes. New plays open with backfield "less": the team leans against the bottom edge.
Colours in the reference: X orange, C grey, Y purple, Z teal, Q red.

Defense (from the defense-play view): two corners, a linebacker, a rusher, a safety
(`C`, `C`, `LB`, `R`, `S`).

## 5. Route tree used for templates

The coach's own tree (images in `rotalar/`, measured against the 5-yard line), yards from the player:
1 flat (one diagonal, 13 across, 4 deep) · 2 slant (2.5 stem, in to 10.5 across / 4.5 deep) ·
3 out (5 stem, 9 out) · 4 in (7 stem, 11 in) · 5 hitch (5 stem, back a yard inside) ·
6 comeback (8 stem, back a yard outside) · 66 curl (8 stem, back a yard inside) ·
7 corner (7 stem, out to 8 across / 11 deep) · 8 post (7 stem, in to 6 across / 12.5 deep) · 9 go (12.5).
Every route that breaks has a left/right switch; a player in the middle (the centre) has no near
sideline, so the coach picks.

## 6. American football defensive fronts

Alignments against a 2x2 offense with the tight end to the right (shotgun, backs at 4.5 yards).
Lateral: yards from the ball, positive toward the tight end (strong side). Depth: yards off the line.
Researched from coaching sources and checked by a second reader; data in `src/domain/playbook/fronts.ts`.
The coach picks the front in the field options (own players on defense, the grey defense on offense)
and when creating an American football play. Positions that stay in a new front keep their routes.

### 4-3

The 4-3 Over is the standard base 4-3. It has four down linemen with the 3-technique tackle set to the tight-end (strength) side and the nose in a weak-side 1-technique shade. The Sam, Mike and Will linebackers play single-gap behind the line, with two corners and two safeties behind them. Coaches use it as an all-purpose, gap-sound base against 11 and 12 personnel. It is strong against the run to the tight end and puts the fast Will on the open side.

| Label | Group | Lateral | Depth | Technique / alignment |
|---|---|---|---|---|
| DE | DL | 4.3 | 1 | 5 technique, outside shoulder of the strong tackle; C gap |
| DT | DL | 2.4 | 1 | 3 technique, outside shoulder of the strong guard; strong B gap |
| NT | DL | -0.6 | 1 | 1 technique, weak-side shade of the centre; weak A gap |
| DE | DL | -4.3 | 1 | 5 technique, outside shoulder of the weak tackle; weak C gap and contain |
| S | LB | 6.4 | 4 | Outside shade of the TE (9/'90' alignment) at linebacker depth; D gap and force |
| M | LB | 0.9 | 5 | 10 alignment, strong-side A gap, just strong of the centre |
| W | LB | -2.4 | 4.5 | 30 alignment, outside shoulder of the weak guard; weak B gap |
| CB | DB | 21 | 6 | Off coverage over Z, outside leverage (about 1 yard outside the receiver) |
| CB | DB | -21 | 6 | Off coverage over X, outside leverage (about 1 yard outside the receiver) |
| SS | DB | 8 | 10 | Two-high shell, strong-side half, roughly on the hash/inside the numbers to the TE side |
| FS | DB | -8 | 12 | Two-high shell, weak-side half, roughly on the hash/inside the numbers to the open side |

Sources: https://throwdeeppublishing.com/blogs/football-glossary/the-4-3-defense-the-complete-guide · https://www.viqtorysports.com/the-different-looks-of-the-4-3-defense/ · https://www.viqtorysports.com/how-to-install-the-4-3-defense-guide-for-coaches/ · https://en.wikipedia.org/wiki/4%E2%80%933_defense · https://www.pff.com/news/defensive-line-techniques-the-prototypes

### 3-4

The 3-4 is an odd front with three down linemen (two 5-technique ends and a 0-technique nose), four linebackers and four defensive backs. In the textbook "Okie" version the three linemen two-gap: the ends take B and C, the nose takes both A gaps. That keeps blockers off the two inside linebackers stacked over the uncovered guards, and the two stand-up outside linebackers play contain and cutback, rush the passer or drop into coverage. Coaches use it to disguise which fourth rusher is coming and to get an extra athletic edge player on the field. It works best with a big anchor nose tackle and long ends.

| Label | Group | Lateral | Depth | Technique / alignment |
|---|---|---|---|---|
| DE | DL | 4.3 | 1 | 5 technique (outside shoulder of the right tackle), 2-gap B/C |
| NT | DL | 0 | 1 | 0 technique (head up on the centre), 2-gap both A gaps |
| DE | DL | -4.3 | 1 | 5 technique (outside shoulder of the left tackle), 2-gap B/C |
| S | LB | 6.6 | 1 | 9 technique on the ball, outside shoulder of the TE, 2-point stance; contain/force |
| J | LB | -5.6 | 1 | Open-side ghost 6 (wide 5) on the ball, about 2 yards outside the left tackle, 2-point stance; contain/cutback/boot or rush |
| M | LB | 1.8 | 4.5 | 20 technique: stacked over the uncovered right guard (bubble), fills A/B gaps |
| W | LB | -1.8 | 4.5 | 20 technique: stacked over the uncovered left guard (bubble), fills A/B gaps |
| CB | DB | 21.1 | 7 | Off coverage on Z with outside leverage (1 yard outside), 7 yards deep |
| CB | DB | -21.2 | 7 | Off coverage on X with outside leverage (1 yard outside), 7 yards deep |
| SS | DB | 8 | 10 | 2-high shell to the TE side, about 2 yards outside the TE at 10 yards; run support, the shallower of the staggered safeties |
| FS | DB | -8 | 12 | 2-high shell to the open side, about 1.5-2 yards inside the slot (#2) at 12 yards; deep half or quarter |

Sources: https://bleacherreport.com/articles/2007958-nfl-101-the-basics-of-the-3-4-defensive-front · https://www.shakinthesouthland.com/2011/5/18/2161194/linebacker-play-alignment-gap-assignments · https://en.wikipedia.org/wiki/3%E2%80%934_defense · https://footballadvantage.com/3-4-defense/ · https://footballtoolbox.net/3-4-defense

### 4-2-5

The 4-2-5 is a nickel front with four down linemen, two linebackers (Mike and Will) and five defensive backs. It swaps the 4-3 Sam linebacker for a nickel/star who can cover the slot and still fit the run, so the defense keeps six men in the box. Coaches use it as their base defense against spread and 11-personnel offenses (Gary Patterson's TCU teams made it famous) and as the standard passing-down package.

| Label | Group | Lateral | Depth | Technique / alignment |
|---|---|---|---|---|
| DE | DL | 5.1 | 1 | 7 technique (inside shoulder of the TE), strong C gap; 6 (head up on the TE) or 9 (outside the TE) are common variants |
| DT | DL | 2.4 | 1 | 3 technique (outside shoulder of the strong guard), strong B gap; lines up toward the strength call (the TE) |
| NT | DL | -0.6 | 1 | 1 technique (weak-side shade of the centre), weak A gap; aligns away from the strength call |
| DE | DL | -4.3 | 1 | 5 technique (outside shoulder of the weak tackle), weak C gap and contain; can widen to a wide 5 on passing downs |
| M | LB | 1.8 | 5 | Aligns to strength, 20 technique (head up on the strong guard) at 5 yards; strong A gap, reads the guard |
| W | LB | -2.4 | 5 | Aligns away from strength, 30 technique (outside shade of the weak guard) at 5 yards; weak B gap, reads the guard |
| NB | DB | -8.7 | 5 | Over the slot (H) with 1 yard of inside leverage, 5 yards deep; walls the slot's vertical release. Against run tendencies he can apex halfway between the tackle and the slot (about -6.7) |
| CB | DB | -21.2 | 7 | Off-coverage 7 yards deep, 1 yard of outside leverage on X (Cover 2/3/1 rule); moves to inside leverage at 7-8 yards in quarters |
| CB | DB | 21.1 | 7 | Off-coverage 7 yards deep, 1 yard of outside leverage on Z (Cover 2/3/1 rule); moves to inside leverage at 7-8 yards in quarters |
| SS | DB | 8 | 10 | Two-high shell on the TE/strength side, 10 yards deep, about 2-3 yards outside the TE; alley and D-gap run support to strength, and rolls down in Cover 3 or Cover 1 |
| FS | DB | -8.5 | 12 | Two-high shell on the weak (slot) side, 12 yards deep, just inside the slot; deep half or quarter, and fills the alley against the run |

Sources: https://www.viqtorysports.com/4-2-5-defense-football-coaching-guide/ · https://www.joedanielfootball.com/blog/425-defense-strengths · https://coachhoover.blogspot.com/2011/01/4-3-vs-oregon-spread-lb-nickel-play.html · https://youthfootballonline.com/understanding-the-4-2-5-defense-strengths-and-weaknesses/ · https://throwdeeppublishing.com/blogs/football-glossary/the-4-2-5-defense-an-in-depth-guide

### 3-3-5

The 3-3-5 odd stack uses three down linemen in a head-up 4-0-4 look (end, nose, end), three linebackers stacked directly behind them, and five defensive backs: two corners, a middle free safety and two hybrid "strong safeties" (Spur to the tight-end side, Bandit to the open side) at 4x4 on the edges. Coaches use it against spread and 11-personnel teams because it puts eight men in the box while keeping five DBs on the field. Slants, stunts and blitzes from the stacks, with Cover 3 behind them, hide which gaps each player fits.

| Label | Group | Lateral | Depth | Technique / alignment |
|---|---|---|---|---|
| DE | DL | 3.6 | 1 | 4 technique: head up on the strong (right) tackle, tight to the ball. Slants to his gap at the snap. |
| NT | DL | 0 | 1 | 0 technique: nose to nose on the center. A-gap player who has to take on the double team. |
| DE | DL | -3.6 | 1 | 4 technique: head up on the weak (left) tackle, tight to the ball. Slants to his gap at the snap. |
| S | LB | 3.6 | 4.5 | 40 technique: stacked directly behind the strong-side end, head up on the tackle. Fills the gap his end does not take. |
| M | LB | 0 | 5 | 00 technique: stacked behind the nose, flat and tempo the ball. Plays either A gap. |
| W | LB | -3.6 | 4.5 | 40 technique: stacked directly behind the weak-side end, head up on the tackle. Fills the gap his end does not take. |
| SP | DB | 9.6 | 4 | 4x4 off the tight end (4 yards outside, 4 deep). Declares strength. D-gap and alley/flat player. |
| B | DB | -7.6 | 4 | 4x4 off the last man on the line (the weak tackle): 4 yards outside, 4 deep, about a yard outside the apex of the tackle and the slot. D-gap and alley/flat player. |
| FS | DB | 0 | 12 | 12 yards deep, splitting the two #1 receivers. Deep middle third. |
| CB | DB | 21.1 | 8 | 1x8 outside #1 (Z): 1 yard outside, 8 yards deep, outside leverage. Deep outside third in Cover 3. |
| CB | DB | -21.2 | 8 | 1x8 outside #1 (X): 1 yard outside, 8 yards deep, outside leverage. Deep outside third in Cover 3. |

Sources: https://gbmwolverine.com/2010/02/24/coachs-corner-different-defenses-the-base-alignment-rules-and-personnel-3-3-5-odd-stack/ · https://gbmwolverine.com/2010/04/08/coachs-corner-rules-gaps-techniques-and-blitz-packages-in-the-base-3-3-5-part-2-outside-gap-blitzes/ · https://youthfootballonline.com/3-3-stack-defense-base-rules-and-blitzes/ · https://www.slideserve.com/birch/3-3-5-stack-defense · https://odumonarchists.com/blogs/news/football-101-basics-of-the-3-3-5-defense-4

### 5-2

The Oklahoma 5-2 is Bud Wilkinson's 1940s odd front and the ancestor of the 3-4. It puts five linemen on the ball: a nose guard head up on the centre, two tackles on the offensive tackles, and two ends on the edges. Two inside linebackers stand a few yards off the ball, facing the offensive guards, and read them. Coaches use it to stop the run between the tackles with two-gap linemen and linebackers free to flow. It pairs with Cover 2, Cover 3 or Cover 1/0 behind it and remains a common base or short-yardage front, especially at high-school and youth level and against power 20/21-personnel teams.

| Label | Group | Lateral | Depth | Technique / alignment |
|---|---|---|---|---|
| DE | DL | 6.6 | 1 | 9 technique (outside shoulder of the TE, edge/contain player) |
| DT | DL | 3.6 | 1 | 4 technique (head up on the strong offensive tackle, two-gap B/C) |
| NG | DL | 0 | 1 | 0 technique (head up on the centre, two-gaps both A gaps) |
| DT | DL | -3.6 | 1 | 4 technique (head up on the weak offensive tackle, two-gap B/C) |
| DE | DL | -5.4 | 1 | Wide 5 (loose outside shoulder of the weak tackle, the last man on the line; edge/contain) |
| M | LB | 1.8 | 4 | 20 technique: stacked head up on the strong guard, keys guard to near back |
| W | LB | -1.8 | 4 | 20 technique: stacked head up on the weak guard, keys guard to near back |
| CB | DB | 21 | 7 | Off coverage over Z, 7 yards, outside leverage (about 1 yard outside the receiver) |
| CB | DB | -21 | 7 | Off coverage over X, 7 yards, outside leverage (about 1 yard outside the receiver) |
| SS | DB | 8.5 | 10 | Two-high shell to the TE side, 10 yards, about 3 yards outside the TE (hash landmark) |
| FS | DB | -9 | 12 | Two-high shell to the open side, 12 yards, over the inside shoulder of the slot (H) |

Sources: https://en.wikipedia.org/wiki/5%E2%80%932_defense · https://en.wikipedia.org/wiki/3%E2%80%934_defense · https://footballtoolbox.net/5-2-defense · https://footballadvantage.com/5-2-defense/ · https://www.viqtorysports.com/football-defenses-explained/

## 7. American football special teams

Six units (the coach dropped onside kick and hands team), each with the unit facing it (NCAA / IFAF rules: kickoff from the 35, 10-yard neutral
zone, at most 5 yards behind the ball for the kicking team). Researched from coaching sources and
checked by a special-teams reader; data in `src/domain/playbook/special.ts`. A special-teams play
shows both units from the start. The board stays one full-width screen: within 6 yards of the
ball depth is true to scale, beyond it both teams are compressed by one factor so a unit and the
one facing it take at most 19 yards (formations.ts fitSpecialDepth). The tables list true yards. Left and right are named from each unit's own side (the punt return and field goal block tables were researched from the kicking side and are relabelled).
Coordinates: x from the kicking team's left sideline, y from the ball (kicking unit y <= 0).

### Kickoff / kickoff return

**Kickoff (kickoff coverage team, 5x5 deep kick from the middle).** The kicker kicks deep from the middle of his team's 35 while the other ten players, five on each side, run down the field in evenly spaced lanes to tackle the returner as far from the end zone as possible. L1/R1 keep the ball inside, the lane players (L2-L4/R2-R4) squeeze it and fill in, and L5/R5 plus the kicker stay back as the safety triangle. Ball: Kicking team's own 35 on a tee (x=26.67, y=0). The receiving team's restraining line is the kicking team's 45 (y=+10). Kicking players line up at their own 30 (y=-5), the most the rules allow.

| Label | x | y | Role |
|---|---|---|---|
| L1 | 4 | -5 | Contain, far left. Stays about 5-8 yds outside the ball, keeps the return inside and never gets outflanked. Aligned 4 yds from the sideline. |
| L2 | 8.5 | -5 | Lane/cover player, aligned on the numbers. Beats his blocker, keeps his lane and keeps the returner on his inside shoulder. |
| L3 | 13 | -5 | Lane/cover player, aligned halfway between the numbers and the hash. Beats his blocker, keeps his lane and squeezes toward the ball. |
| L4 | 17.5 | -5 | Bullet/force player (called 'wedge buster' in older schemes), 2.5 yds outside the left hash. Goes straight at the ball and takes on the blocker in the return lane. |
| L5 | 22 | -5 | Left safety, the inside player next to the kicker. Sprints 25-30 yds, then settles about 10 yds behind the coverage wall as the second line of defense. |
| K | 24.67 | -8 | Kicker, and the deepest safety after the kick (about 15 yds behind the wall). Starts about 8 yds back and 2 yds to the side of the tee (right-footed approach). He is the only player allowed deeper than 5 yds. |
| R5 | 31.33 | -5 | Right safety, the inside player next to the kicker. Makes the 3-man safety triangle with L5 and K, about 10 yds behind the coverage wall. |
| R4 | 35.83 | -5 | Bullet/force player, 2.5 yds outside the right hash (x=33.33). Goes straight at the ball and takes on the blocker in the return lane. |
| R3 | 40.33 | -5 | Lane/cover player, aligned halfway between the hash and the numbers. Keeps his lane and squeezes toward the ball. |
| R2 | 44.83 | -5 | Lane/cover player, aligned on the numbers. Keeps the returner on his inside shoulder. |
| R1 | 49.33 | -5 | Contain, far right. Keeps the ball inside and never gets outflanked. Aligned 4 yds from the sideline. |

**Kickoff return (5-2-2-2 middle return: front five, two wings, two upbacks, two deep returners).** The return team catches the kickoff near its own goal line and runs a called return (middle, left or right). Blockers drop back from three levels and each blocks an assigned coverage player one-on-one. Before turning to block, the front five also guard against onside and squib kicks, so they line up 12-15 yds from the ball. Ball: Ball on the kicking team's 35 tee (x=26.67, y=0). The return team's restraining line is 10 yds away at the kicking team's 45 (y=10). The front line is 12-15 yds away (kicking team's 47 to midfield), the wings are at their own 35 (y=30), the upbacks at their own 20 (y=45) and the returners at their own 5 (y=60). The goal line is at y=65.

| Label | x | y | Role |
|---|---|---|---|
| RT | 10 | 12 | Front-line right tackle (the return team's right, so the kicking team's left, low x). Lines up across from L2, 12 yds from the ball, just inside the numbers. Watches for onside kicks, then drops back to about his own 35 and kicks out #2 (L2). |
| RG | 20 | 15 | Front-line right guard, on the low-x hash, 15 yds from the ball (midfield). Drops back to about his own 35 and crosses to block the opposite #4 (R4). |
| C | 26.67 | 12 | Front-line center, straight in front of the kicker, 12 yds from the ball. Covers short and onside kicks and sets the wall. On the return he chips the most dangerous #5, then works to the kicker or a safety. |
| LG | 33.33 | 15 | Front-line left guard, on the high-x hash, 15 yds from the ball. Drops back and crosses to block the opposite #4 (L4). |
| LT | 43.33 | 12 | Front-line left tackle (the return team's left, so the kicking team's right, high x). Lines up across from R2, 12 yds from the ball. Drops back to about his own 35 and kicks out #2 (R2). |
| RW | 14 | 30 | Right wing/second-level blocker, inside the numbers on his own 35. Drops back and kicks out the opposite #3 (R3) around the 30. He also fields short or pooch kicks in his area. |
| LW | 39.33 | 30 | Left wing/second-level blocker, inside the numbers on his own 35. Drops back and kicks out the opposite #3 (L3) around the 30. |
| RU | 18 | 45 | Right upback (fullback), 2 yds outside the low-x hash on his own 20. Handles squib kicks, then sets up about 10-15 yds in front of the catch and blocks the #5 on his side (L5). |
| LU | 35.33 | 45 | Left upback (fullback), 2 yds outside the high-x hash on his own 20. Sets up in front of the catch and blocks the #5 on his side (R5). |
| KR | 20 | 60 | Deep returner on the low-x hash, feet on his own 5. Calls 'Me/You/Short', catches the kick and hits the middle seam. |
| KR2 | 33.33 | 60 | Second deep returner on the high-x hash, own 5. If he does not catch the ball, he becomes the lead blocker (usually on the kicker or the first free coverage player). |

Sources: https://footballtoolbox.net/special-teams/kickoff-coverage-team-part-2 · https://footballtoolbox.net/special-teams/kickoff-coverage-and-huddle-alignment · https://gridironstrategies.com/article/critical-keys-for-building-rock-solid-kickoff-coverage-schemes · https://scoutingacademy.com/itp-glossary-5x5-kickoff-alignment/ · https://www.sdcfoa.org/ncaa/rule-6-kicks/college-6-1-2

### Punt / punt return

**Punt (standard spread punt).** The spread punt protects the punter with a tight five-man line (LS, two guards, two tackles at 1-2 ft splits), two wings set off the line and a personal protector (PP) 5 yds deep, while two gunners split wide release at the snap to go after the returner; the snap-to-kick target is 2.0 s or less. After the kick, everyone covers in an assigned lane with a landmark: the wings contain, the PP follows the ball as a second-level player and the punter is the last-line safety. Ball: LOS: the ball is on the ground under the long snapper, in the middle of the field (x = 26.67). The punter catches the snap about 14 yds deep (y = -14) and kicks about 12-13 yds deep, never closer than 10 yds to the LOS.

| Label | x | y | Role |
|---|---|---|---|
| LS | 26.67 | -0.5 | Long snapper: snaps about 14 yds to the punter in about 0.75-0.8 s, blocks his gap, then covers down the middle (landmark: center of the goalposts) |
| LG | 25.47 | -1 | Left guard: 1-2 ft split, helmet breaking the plane of the snapper's belt, protects inside-out; covers 4 yds inside the left hash (landmark: goalpost) |
| RG | 27.87 | -1 | Right guard: 1-2 ft split, helmet breaking the plane of the snapper's belt, protects inside-out; covers 4 yds inside the right hash (landmark: goalpost) |
| LT | 24.27 | -1 | Left tackle: lines up level with the guard at a 1-2 ft split; blocks his man, then covers 1 yd outside the left hash |
| RT | 29.07 | -1 | Right tackle: lines up level with the guard at a 1-2 ft split; blocks his man, then covers 1 yd outside the right hash |
| LW | 23.27 | -2 | Left wing: off the line, inside foot at the tackle's outside foot and deep enough to touch the tackle's hip (about 1 yd deeper); blocks the edge rusher (in/out rule); outside contain in coverage (landmark: the numbers) |
| RW | 30.07 | -2 | Right wing: off the line, inside foot at the tackle's outside foot and deep enough to touch the tackle's hip (about 1 yd deeper); blocks the edge rusher (in/out rule); outside contain in coverage (landmark: the numbers) |
| PP | 27.27 | -5 | Personal protector: heels at 5 yds in the A-gap on the punter's kicking-foot side (right A-gap for a right-footed punter). He calls the protection, moves to any overload, can run fakes, and follows the ball as a second-level player when it is kicked |
| P | 26.67 | -14 | Punter: heels about 14 yds behind the ball (15 in the NFL, 12-13 at youth/HS level), directly behind the snapper; kicks in 1.75-1.95 s, then becomes the last-line safety about 25 yds behind the ball |
| GUN | 13.67 | -0.5 | Left gunner: split 12-14 yds from the ball on the LOS, never within 5 yds of the sideline, two-point stance with the outside foot back (inside foot marks the LOS); releases at the snap past the jammer and aims for the returner's outside shoulder |
| GUN | 39.67 | -0.5 | Right gunner: split 12-14 yds from the ball on the LOS, never within 5 yds of the sideline, two-point stance with the outside foot back (inside foot marks the LOS); releases at the snap past the jammer and aims for the returner's outside shoulder |

**Punt return (single jam, return middle).** The return unit first lines up gap-sound to defend a fake. Then the front holds up the punt team at the line while one jammer on each gunner slows him down, so the returner (about 40 yds deep) can catch cleanly. After the kick, the box players peel back to set up the call (middle return or a wall along one sideline), and the returner chooses between a return and a fair catch; balls going inside the 10 are usually let go. Ball: LOS: the ball is at y = 0 in the middle of the field. The front is 1 yd off the ball, the jammers and hold-up players are 5 yds off, and the punt returner is about 40 yds downfield (y = +40).

| Label | x | y | Role |
|---|---|---|---|
| PR | 26.67 | 40 | Punt returner: 35-45 yds deep (40 is standard in college, 32-38 in HS/amateur play), centered, adjusted for the punter's average distance, the wind and the hash. Decides return, fair catch or let it go; does not field inside his own 10 |
| JAM | 14.67 | 5 | Jammer on the gunner at the left of the diagram (low x): 5-6 yds off, about 1 yd inside the gunner. Takes away the inside release, rides him to the sideline and stays between him and the returner |
| JAM | 38.67 | 5 | Jammer on the gunner at the right of the diagram (high x): 5-6 yds off, about 1 yd inside the gunner. Takes away the inside release, rides him to the sideline and stays between him and the returner |
| R3 | 22.37 | 1 | Edge rusher/holder outside the left wing (9-technique): threatens the edge, holds up the wing, then peels back to set the return; contain against a fake |
| R2 | 23.87 | 1 | Rusher/holder on the outside shoulder of the punt team's left tackle: jams him at the snap so he cannot release freely, then gets into position to block |
| R1 | 25.07 | 1 | Rusher/holder on the outside shoulder of the punt team's left guard (never over the snapper): holds up the guard and checks for an A-gap fake |
| L1 | 28.27 | 1 | Rusher/holder on the outside shoulder of the punt team's right guard (never over the snapper): holds up the guard and checks for an A-gap fake |
| L2 | 29.47 | 1 | Rusher/holder on the outside shoulder of the punt team's right tackle: jams him at the snap, then gets into position to block |
| L3 | 30.97 | 1 | Edge rusher/holder outside the right wing (9-technique): threatens the edge, holds up the wing, then peels back to set the return; contain against a fake |
| LB | 24.67 | 5 | Left hold-up/fake-check player about 5 yds off: reads the PP and the left wing for a run or pass fake, then turns to lead the return or join the wall |
| LB | 28.67 | 5 | Right hold-up/fake-check player about 5 yds off: reads the PP and the right wing for a run or pass fake, then turns to lead the return or join the wall |

Sources: https://footballtoolbox.net/spread-punt-alignment (Football Toolbox - spread punt alignment: 12-18 in splits, guard helmet breaks the plane of the center's belt, wing touches the tackle's hip, PP 5 yds in the A-gap protecting the punter's kicking foot, punter 14 yds, gunners 12-14 yds from the ball / 5 yds from the sideline with the outside foot back, punt off in 1.75-1.95 s; verified) · https://footballtoolbox.net/punt-protection-cover (Football Toolbox - punt protection and cover: 18-24 in splits, guard/tackle alignment, blocking technique) · https://kihuenergia.kihu.fi/urapolku/media/Amer.%20jalkapallo_439_PuntprotandcoverageChristopherColumbushs.pdf (James Vint, Christopher Columbus HS clinic - one-foot splits, PP to any overload, step inside-outside-kick outside and lock up, 'Right' call vs 8/9-man rush protecting the punter's off leg, gunners release on the snap / linemen, wings and PP on the kick, coverage lanes and landmarks, punter as safety 25 yds from the ball; verified from PDF text) · https://scoutingacademy.com/itp-glossary-spread-punt-formation/ (Scouting Academy - spread punt: PP 5 yds in line with a guard, punter 14-15 yds, gunners wide) · https://scoutingacademy.com/itp-glossary-shield-punt-formation/ (Scouting Academy - shield punt: 2-yd splits, three-man shield, NCAA vs NFL downfield rule)

### Field goal & PAT / block

**Field goal / PAT (placekick) team.** A tight nine-man wall of blockers (long snapper, two guards, two tackles, two ends and two wings) stands shoulder to shoulder with 6-inch, toe-to-heel splits. It protects a holder who catches the snap 7 yards behind the line and a soccer-style kicker. Every blocker takes his inside gap first, then the ends and wings hinge outside to push edge rushers wide, so the kick is away in about 1.25 to 1.35 seconds. Ball: Snapped at the line (y=0). For a PAT under NCAA/IFAF rules the snap is from the 3-yard line, anywhere between the hashes, usually the middle (x=26.67). A field goal is snapped where the last play ended, often on a hash (NCAA/IFAF hashes are 20 yd from each sideline, so x=20.0 or x=33.33; shift every x by -6.67 or +6.67). The kick is struck at the holder's spot, 7 yards behind the line (x=26.67, y=-7).

| Label | x | y | Role |
|---|---|---|---|
| LS | 26.67 | -0.5 | Long snapper: snaps about 7 yards to the holder in 0.35-0.40 s. Under NCAA rules, in a scrimmage-kick formation no defender may contact him until 1 s after the snap. He then blocks or covers. |
| LG | 25.57 | -0.7 | Left guard: 3-point stance, inside foot back, inside toe at the snapper's heel (6-inch split). Takes a 6-inch jab step with the inside foot and punches the inside (A) gap. Never steps outside. |
| RG | 27.77 | -0.7 | Right guard: mirrors LG. Seals the right A gap and protects the snapper's side. |
| LT | 24.47 | -0.8 | Left tackle: toe to the guard's heel with a 6-inch split. Jab step inside and uppercut to seal the B gap. Blocks an area, not a man. |
| RT | 28.87 | -0.8 | Right tackle: mirrors LT and seals the right B gap. |
| LE | 23.37 | -0.9 | Left end (tight end): toe to the tackle's heel, 2- or 3-point stance, square to the line. Punches the inside C gap first, then 'rocks' the outside foot back to help against the edge. Eligible receiver on fakes. |
| RE | 29.97 | -0.9 | Right end (tight end): mirrors LE. Takes the C gap, then rocks outside. Eligible on fakes. |
| LW | 22.6 | -1.9 | Left wing: one yard deeper than the end, inside foot behind the end's outside foot, turned about 45 degrees with the outside foot back. Jabs inside, then hinges out to wash the edge rusher wide and lengthen his path. Eligible on fakes. |
| RW | 30.74 | -1.9 | Right wing: mirrors LW. Guards inside first, then hinges out on the edge rusher. Fake receiver. |
| H | 27.3 | -7 | Holder: kneels 7 yards deep beside the kick spot. For a right-footed kicker he kneels just right of the spot on his right knee with the back knee up, which leaves the plant-foot side open. He calls 'set', catches, places the ball, spins the laces forward, and is the passer or runner on fakes and 'fire' calls. |
| K | 25.1 | -9.4 | Placekicker: right-footed, soccer style. Stands about 2.5 yards behind the spot and about 1.5 yards to its left ('3 back, 2 over'). Kicks about 1.3 s after the snap, then becomes the safety. |

**Field goal / PAT block team.** The block team puts a defender in every gap of the protection to drive the wall back 1-2 yards, with a tall jumper behind the middle to get hands into the kick's low flight path. Two edge rushers come from outside the wings toward the block point in front of the holder. Two safeties stay outside and deep enough to take the eligible wings, ends and holder on a fake, and after a block the unit scoops and returns the ball. Ball: The same ball as the kicking team: snapped at y=0 and kicked from about y=-7. The block point is about y=-2 to -5. Middle rushers need 1-2 yards of push. The edges aim about 2-3.5 yards in front of the holder, which is roughly 8-9 yards of running. On a PAT from the 3 the goal line is at y=3 and the end line at y=13.

| Label | x | y | Role |
|---|---|---|---|
| ER | 21.5 | 1 | Edge rusher, kicking team's left: sprinter or 3-point stance, stationary within 1 yard, just outside the left wing's outside hip. Rushes flat and tight to the block point about 2-3 yards in front of the holder with hands extended, thumbs together, and never leaves his feet early. |
| CR | 23.9 | 0.8 | C-gap rusher, left: sits in the gap between the left tackle and left end. Crashes inside to occupy the end, which creates a 2-on-1 with the edge, then gets his hands up. He is the first to contain a fake that bounces outside. |
| BR | 25 | 0.8 | B-gap push, left: shades the tackle's inside shoulder. Drives him back about 4 steps, then gets his hands up in the kick lane. |
| AR | 26 | 0.8 | A-gap push, left: shades the left guard's inside shoulder and stays outside the snapper's pads. Bull-rushes the guard 1-2 yards into the backfield to raise the wall under the kick. |
| J | 26.67 | 1.6 | Jumper: tallest or best leaper, stacked about 1.5 yards off the ball behind the A-gap pair. Follows the push and jumps straight up with both arms extended. Under NCAA 9-1-11 he may not leap over a blocker because he is not stationary within 1 yard of the line. |
| AL | 27.35 | 0.8 | A-gap push, right: shades the right guard's inside shoulder and never aligns on or strikes the snapper during the first second. Drives the guard back and gets his hands up. |
| BL | 28.35 | 0.8 | B-gap push, right: shades the right tackle's inside shoulder. Drives 4 steps, then hands up. |
| CL | 29.45 | 0.8 | C-gap rusher, right: sits in the gap between the right tackle and right end. Pinches the end to free the edge, and contains any fake to his side. |
| EL | 31.85 | 1 | Edge rusher, kicking team's right: outside the right wing's outside hip. Rushes to the block point in front of the holder. Put the best edge rusher on the kicker's foot side (the side the right-footed kick crosses). |
| SR | 20.3 | 5.5 | Fake safety, left: about 5-6 yards deep and 2 yards outside the left wing, reading the holder. Takes the wing or end man-to-man on a fake pass, fills against holder or kicker runs, and becomes the scoop-and-return lead after a block. |
| SL | 33 | 5.5 | Fake safety, right: mirrors SL. Covers the right wing or end on a fake, fills on the run, and scoops and escorts after a block. |

Sources: USA Football - The fundamentals of proper field goal and PAT protection: https://blogs.usafootball.com/blog/3465/the-fundamentals-of-proper-field-goal-and-pat-protection (holder 7 yds deep, back knee up; guards and tackles toe-to-heel; wings one yard deeper than the TE at 45 degrees; 6-inch inside jab step) · Football Toolbox - P.A.T. & Field Goal Team: https://footballtoolbox.net/p-a-t-field-goal-team (6-inch splits, shoulder-width base, inside foot back; wings at arm's length; kick spot about 8 yds; snap-to-kick 1.25-1.30 s; 'block an area, not a man') · Football Toolbox - P.A.T. and Field Goal Part 2: https://footballtoolbox.net/p-a-t-and-field-goal-part-2 (Wings, Stack and Gate alignments; kicker spot 7 1/3 yds; Gate: center 1-2 yds outside the hash, holder 6 deep offset 2 yds, Reno/Vegas/Red decision tree) · Football Toolbox - Field Goal and Try Schemes: https://footballtoolbox.net/field-goal-and-try-schemes (seven down plus two wings as the base; Stack of 3 to the kicker's foot side; Gate/swinging gate) · The Scouting Academy - ITP Glossary: Field Goal and Extra Point Protection: https://scoutingacademy.com/itp-glossary-field-goal-and-extra-point-protection/ (overlap technique, end 'rocker', wings lengthen the edge; college under 1.3 s, NFL under 1.2 s; edges must cover about 9 yds, middle needs only 1-2 yds of push; tackle-over inside the 10 because of wide college hashes)
