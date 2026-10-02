# Print Feature: Functional Spec

This spec comes from a 2:33 screen recording of a reference playbook app, read by five people, plus the coach's narration. It copies the app's logic, not its design. Where the readers disagree, the reader whose slice showed that screen wins, and section 10 lists each disagreement.

---

## 1. Flow at a glance

1. The coach opens the **Print menu** in one of two ways: from a playbook row in the playbook list, or from the toolbar inside a playbook.
2. The coach picks a **format card**, which opens that format's screen.
3. On the format screen the coach sets three things:
   - **which plays**: side and category
   - **style**: layout, which fixes how many plays go on a page or card
   - **settings** for that format
4. **Print** opens the browser's own print dialog, where the coach sends to a printer or saves as PDF.
5. **Cancel** in the dialog returns to the format screen with every setting kept.

---

## 2. Entry points

| # | Where | Control | Result |
|---|---|---|---|
| 1 | **Playbook list** | Each row has four icons on the right, in this order: **printer**, two-person icon (probably share or team), info, drag handle. The printer is the first. | Opens the Print menu for that playbook. |
| 2 | **Inside a playbook** | A toolbar at the top centre has five icons: info, a vertical double arrow with padlock, gear, list, **printer**. The printer is the last. | Opens the same Print menu. The narration says the options are the same when you print after picking a category such as "All Offensive Plays". |

- Both entry points open the same modal with the same formats.
- Section 11 asks whether the sidebar category chosen inside a playbook pre-selects the print category.

---

## 3. Print menu (top level of the modal)

**Header**
- Close button (circled X) at top-left.
- Centred title "PRINT".

**Help row**
- A full-width row with a document icon: "Click here to learn how to create PDFs".
- It opens a **PDF Help** screen with a back arrow `<`, one line of help text and a "See the tutorial videos" button.
- Our version needs our own help text or link.

**Format cards**
- Laid out in a 2-column grid.
- Each card shows a title, a style count, a `>` chevron and a preview thumbnail.
- A hovered card gets a lighter background.
- The menu scrolls.

| Card | Styles | Screen title |
|---|---|---|
| Wristbands – Diagrams | 11 | WRISTBANDS |
| Wristbands – List | 3 | WRISTBANDS |
| Call Sheets – Diagrams | 14 | CALL SHEETS |
| Call Sheets – List | 4 | CALL SHEETS |
| Playbooks | 8 | PLAYBOOK |
| Scout Cards | 3 | SCOUT CARDS |
| Route Tree | 3 | (never opened) |

**Route Tree** is a slim full-width row at the bottom of the menu. It has a branching-arrows icon and no thumbnail, and it only shows after scrolling.

---

## 4. Format screen (shared shell)

**Header**
- `<` back to the Print menu.
- Centred title: the format family.
- A **Print** button (text plus printer icon) at top-right.

**Print button state**
- It is **disabled and greyed** when the current selection holds 0 plays. This was seen on the defense side, which had 0 plays.

**Body layout, type A**: Wristbands Diagrams, Wristbands List, Call Sheets Diagrams

| Left column | Middle column | Right column |
|---|---|---|
| Play selection (section 5) | Style tiles in a vertical scrolling list, single-select | Settings in a vertical scrolling panel |

**Body layout, type B**: Call Sheets List, Playbook, Scout Cards
- The play-selection panel on the left is wider.
- On the right, the style tiles sit in a row or grid, with a few settings rows below them.

**Controls and state**
- Every setting is a **segmented button group**, single-select, and the selected option is lighter.
- The selected style tile shows a checkmark at its top-left and a lighter background.
- Switching style does not change the settings panel. Settings are per format, not per style.
- Settings are kept after cancelling the browser dialog and after back navigation within one modal session.
- Section 11 asks whether settings persist when the modal is reopened.

---

## 5. Play selection (the same on every format screen)

**Side toggle**
- A two-button segmented control at the top of the left panel, icons only: **O = Offense** (default) and **X = Defense**.
- The narration confirms: "Aynı şekilde defans içinde geçerli" ("the same applies to defense").

**Category list**
- Shown below the toggle.
- Each row has the category name on the left and its play count on the right.
- It is **single-select**: clicking "Pass" moved the checkmark off "All Offensive Plays", and clicking back moved it back.
- The selected row has a checkmark and a lighter background.
- Categories with 0 plays are dimmed.

| Side | Rows seen (the "Beach Flag" playbook) |
|---|---|
| Offense | All Offensive Plays (12, default), Run (0), Pass (12), Uncategorized (0) |
| Defense | All Defensive Plays (0, default), Base (0), Red Zone (0), Uncategorized (0) |

**Where categories come from**
- The list mirrors the playbook sidebar, which has an "Edit Categories" control.
- A play's categories are assigned in its Play detail modal. In that modal, Play 12 showed a "Categories" list with Run and Pass, and Pass was checked.
- "All …" means every play on that side. "Uncategorized" means plays with no category.

**Selection and order**
- There are **no per-play checkboxes**. Plays are chosen by side plus category.
- **Print order is play-number order**, which the playbook grid sets with drag handles.
- This was confirmed in a real print: 12 plays at 2 per page gave page 1 = Play 1 and Play 2, and so on, for 6 sheets.

---

## 6. Formats

### 6.1 Wristbands – Diagrams (11 styles)

**Output**
- Wristband insert cards sized in inches (Width × Height).
- Each card holds a grid of cells, and each cell is one play:
  - a **black label bar** on top, holding the play name and/or number
  - the play diagram below, with coloured position icons and routes

**Styles, in list order** (default **8 Plays**)

| Style | Grid (cols × rows) |
|---|---|
| 8 Plays | 4 × 2 |
| 6 Plays | 3 × 2 |
| 4 Plays | 2 × 2. The labels sit in a thick vertical strip between the two columns, not on top. |
| 4 Plays – Columns | 4 × 1, tall portrait cells, label on top |
| 3 Plays | 3 × 1, tall cells |
| 2 Plays | 2 × 1 |
| 1 Play | 1 × 1 |
| 15 Plays | 5 × 3 |
| 12 Plays | 4 × 3 |
| 10 Plays | 5 × 2 |
| 9 Plays | 3 × 3 |

The last four styles carry a "NEW" badge in the reference app. That badge covers the checkmark, which is irrelevant for us.

**Settings**

| Setting | Control | Options | Default |
|---|---|---|---|
| Width (inches) | segmented, 9 | 3" · 3.25" · 3.5" · 3.75" · 4" · 4.25" · 4.5" · 4.75" · 5" | 3" |
| Height (inches) | segmented, 6 | 2" · 2.25" · 2.5" · 2.75" · 3" · 3.5" | 2" |
| Zoom | segmented, 5 | 50% · 75% · 100% · 125% · 150% | 100% |
| Position Icon Size | segmented, 3 | Small · Medium · Large | Medium |
| Route Line Weight | segmented, 3 | Thin · Medium · Thick | Medium |
| Play Label Style | segmented, 2 | Prominent · Compact | Prominent |
| Play Labels | segmented, 3 | Both · Name · Number | Both |
| Play Label Color Coding | segmented, 2 | Auto · Custom | Auto |
| Text Annotations | segmented, 3 | Hide · Show · Large | Hide |
| Copies | segmented, 12 | 1 through 12 | 1 |

### 6.2 Wristbands – List (3 styles)

**Output**
- Text-only wristband cards: striped rows (alternating white and light grey), each row a play name.
- A dark column of play numbers runs down the left edge of each list column.
- Colour-coded header bands mark category or label colours. The preview shows red and orange.

**Styles**: **1 Column** (default) · 2 Columns · 3 Columns. They sit in a vertical list, and all settings fit without scrolling.

**Settings**

| Setting | Control | Options | Default |
|---|---|---|---|
| Width (inches) | segmented, 9 | 3" to 5" in 0.25" steps (same as 6.1) | 3" |
| Height (inches) | segmented, 6 | 2" · 2.25" · 2.5" · 2.75" · 3" · 3.5" | 2" |
| Play Labels | segmented, 2 | Name & Number · Name | Name & Number |
| Play Label Color Coding | segmented, 2 | Auto · Custom | Auto |
| Copies | segmented, 12 | 1 through 12 | 1 |

There is no Zoom, icon size, line weight, label style or annotations setting in this format.

### 6.3 Call Sheets – Diagrams (14 styles)

**Output**
- A full sheet holding a grid of play diagrams.
- Each row of cells is headed by a thick black label bar.
- The menu preview shows a small orange logo block and a title at top-left, and small text at top-right.
- The style tiles show a second page behind the first, so a sheet can run to several pages.

**Styles**: named "N Plays – C×R Grid" (columns × rows). Default **24 Plays 4×6**. More columns than rows gives tall, narrow cells. Fewer columns gives wide cells.

| Style | Plays per page |
|---|---|
| 4×6, 6×4 | 24 |
| 3×6, 6×3 | 18 |
| 4×4 | 16 |
| 3×5, 5×3 | 15 |
| 3×4, 4×3 | 12 |
| 2×5, 5×2 | 10 |
| 3×3 | 9 |
| 2×4, 4×2 | 8 |

List order: 24 4×6, 24 6×4, 18 3×6, 18 6×3, 16 4×4, 15 3×5, 15 5×3, 12 3×4, 12 4×3, 10 2×5, 10 5×2, 9 3×3, 8 2×4, 8 4×2.

**Settings** (the panel starts at Zoom: there is no Width or Height)

| Setting | Control | Options | Default |
|---|---|---|---|
| Zoom | segmented, 5 | 50% · 75% · 100% · 125% · 150% | 100% |
| Position Icon Size | segmented, 3 | Small · Medium · Large | **Small**, not Medium as on wristbands |
| Route Line Weight | segmented, 3 | Thin · Medium · Thick | Medium |
| Play Label Style | segmented, 2 | Prominent · Compact | Prominent |
| Play Labels | segmented, 3 | Both · Name · Number | Both |
| Play Label Color Coding | segmented, 2 | Auto · Custom | Auto |
| Text Annotations | segmented, 3 | Hide · Show · Large | Hide |

No Copies row was seen.

### 6.4 Call Sheets – List (4 styles)

**Output**
- One sheet with a logo and title at top-left.
- The body is 1 to 4 vertical columns of striped play-name rows, each with a dark strip on its left.
- The menu preview shows the plays grouped into **colour-coded category sections**, each with its own coloured header bar. Colours seen: black, orange, yellow, green, blue, red.

**Styles**: **1 Column** (default) · 2 Columns · 3 Columns · 4 Columns, shown as a horizontal row of tiles (layout type B).

**Settings**

| Setting | Control | Options | Default |
|---|---|---|---|
| Play Labels | segmented, 2 | Name & Number · Name | Name & Number |
| Play Label Color Coding | segmented, 2 | Auto · Custom | Auto |

### 6.5 Playbook (card "Playbooks", screen "PLAYBOOK", 8 styles)

**Output**
- Portrait pages.
- Each play box has a header with a dark square **play-number badge** and the **play name**, then the diagram.
- Styles with notes also print the play notes and the **position notes**: one row per position, a coloured position icon followed by text.
- Notes come from the Play modal: "Optional Play Notes" plus a "Position Note" for each position. In "Beach Flag" the positions are Q, Y, X and C.

**Styles**: shown as a 4×2 tile grid. Default **1 Play**.

| Style | Layout |
|---|---|
| 1 Play | one full-page diagram |
| 1 Play – Notes Below | diagram at top, notes below |
| 1 Play – Notes on Side | tall diagram on the left, notes on the right |
| 2 Plays – Top & Bottom | two landscape diagrams, stacked |
| 2 Plays – Left & Right | two tall diagrams, side by side |
| 4 Plays | 2 × 2 |
| 6 Plays | 3 cols × 2 rows |
| 9 Plays | 3 × 3 |

**Settings**

| Setting | Control | Options | Default |
|---|---|---|---|
| Player Names | segmented, 2 | Hide · Show | Hide |
| Play Labels | segmented, 3 | Both · Name · Number | Both |

### 6.6 Scout Cards (3 styles). This is the only format actually printed in the video.

**Styles**: **1 Play** (default) · 2 Plays – Top & Bottom · 2 Plays – Left & Right.

**Settings**

| Setting | Control | Options | Default |
|---|---|---|---|
| Player Names | segmented, 2 | Hide · Show | Hide |
| Play Labels | segmented, 3 | Both · Name · Number | Both |

**Observed printed output**

The run used 2 Plays – Left & Right, Player Names Show, Play Labels Both and All Offensive Plays (12 plays). It gave **6 portrait sheets**, with 2 tall cards side by side per sheet.

**Card structure**
- A thin light-grey border.
- The header is a light-grey bar holding a dark square badge with the white play number, then the play name. With "Both", the number and the name both show.

**Card body, top to bottom**
1. empty white area
2. large faint italic watermark "TFF" (probably the team name)
3. divider
4. field zone
5. divider
6. faint watermark "OPPONENT"
7. empty white area

**Field zone details**
- A horizontal grey line of scrimmage, with faint hash dashes in the centre.
- Players:
  - X: orange circle
  - C: dark square on the line
  - Y: purple circle
  - Q: red circle behind C
- The letters print inside the icons.
- Routes are drawn in each player's colour and end in arrowheads.
- Small yardage labels sit beside the routes ("1 yard", "4 yard", "5 yard").

### 6.7 Route Tree (3 styles)

The card was seen in the menu but never opened. Its layout and settings are unknown (see section 11).

---

## 7. Plays per page or card

| Format | Options |
|---|---|
| Wristbands – Diagrams | 1, 2, 3, 4, 4 (columns), 6, **8** (default), 9, 10, 12, 15 per card |
| Wristbands – List | 1, 2 or 3 list columns; how many rows fit depends on card Width × Height |
| Call Sheets – Diagrams | 8, 9, 10, 12, 15, 16, 18, **24** (default) per page, most counts in two orientations |
| Call Sheets – List | 1, 2, 3 or 4 list columns; rows fill the page |
| Playbook | **1** (default; plain, notes below, notes on side), 2 (top & bottom, left & right), 4, 6, 9 per page |
| Scout Cards | **1** (default), 2 (top & bottom, left & right) per page |
| Route Tree | unknown |

---

## 8. Which settings each format has

| Setting | Wristband Diagrams | Wristband List | Call Sheet Diagrams | Call Sheet List | Playbook | Scout Card |
|---|---|---|---|---|---|---|
| Width / Height (in) | 3" / 2" | 3" / 2" | – | – | – | – |
| Zoom | 100% | – | 100% | – | – | – |
| Position Icon Size | Medium | – | Small | – | – | – |
| Route Line Weight | Medium | – | Medium | – | – | – |
| Play Label Style | Prominent | – | Prominent | – | – | – |
| Play Labels: Both / Name / Number | Both | – | Both | – | Both | Both |
| Play Labels: Name & Number / Name | – | Name & Number | – | Name & Number | – | – |
| Play Label Color Coding | Auto | Auto | Auto | Auto | – | – |
| Text Annotations | Hide | – | Hide | – | – | – |
| Player Names | – | – | – | – | Hide | Hide |
| Copies (1 to 12) | 1 | 1 | not seen | – | not seen | not seen |

---

## 9. Printing and PDF output

**Starting a print**
- The format screen's **Print** button hands off to the **browser's own print dialog** (window.print). The app has no PDF generator of its own.

**What the dialog showed** (Chrome, Turkish UI)

| Field | Value shown |
|---|---|
| Destination (Hedef) | "Microsoft Print to PDF" |
| Pages (Sayfalar) | All |
| Layout (Düzen) | Portrait |
| Color (Renk) | Color |
| More settings (Daha fazla ayar) | collapsed |
| Buttons | Print (Yazdır, primary) and Cancel (İptal) |

- The sheet count shows at the top of the dialog ("6 kağıt").

**Getting a PDF or a paper copy**
- Pick a PDF destination to save a PDF, or a connected printer to print on paper.
- The narration says the same: it goes to the printer if one is connected, and it can also show or save the result as PDF.

**Cancel**
- Returns to the format screen with every setting kept.

**Page content**
- Pages follow the selected side and category, in play-number order, split into pages by the style's plays-per-page.

**Browser headers and footers**
- Chrome added its default page headers and footers: date and time, page title, URL, and "1/6".
- Our print stylesheet should suppress these, for example by setting `@page` margins, and should hide all app chrome under `@media print`.
- Wristband cards must print at the true physical inch size.

**Adapting to our app** (not from the video)
- For American football, the Offense/Defense toggle needs a third side, **Special Teams**, with categories such as Kickoff, Kickoff Return, Punt, Punt Return, Field Goal / PAT and FG/PAT Block, plus "All Special Teams Plays". This follows the triggering user request.
- Dense styles (12 or 15 per wristband) with 11 players per side may need smaller icons by default.

---

## 10. Reader disagreements (and which reading is used)

1. **Route Tree card.** Readers 2, 4 and 5 saw 6 cards. Readers 1 and 3 scrolled the menu and saw a 7th, Route Tree. **Used: 7 cards.**
2. **Single or multi-select categories.** Readers 3 and 5 were unsure. Reader 2's slice showed a click on Pass moving the checkmark. **Used: single-select.**
3. **Wristband default style.** Reader 3 saw no checkmark in its first session, because 12 Plays, carried over from reader 2's click, was selected and its NEW badge hides the check. On reopen, 8 Plays was checked (readers 2 and 3). **Used: default 8 Plays.** The style seems to reset when the modal is reopened.
4. **15 Plays selection (reader 4)** and **12 Plays (reader 2).** Both are inferred from the tile highlight only, because the NEW badge covers the checkmark.
5. **Call sheet orientation.** The menu thumbnails show landscape sheets (readers 1, 2, 3 and 5). The style tiles on the opened screen show portrait pages (reader 4). **Used: reader 4's tiles.** Orientation is chosen in the browser dialog anyway, where the default was Portrait.
6. **Second toolbar icon.** Readers 1, 3 and 5 read it as a vertical arrow with padlock. Reader 4 read it as a sort or text icon. This does not affect printing.
7. **Plays-per-page list.** Reader 1's summary of the narration (1, 2, 3, 4, 6, 8, 12, 15) leaves out 9 and 10. Readers 2, 3 and 4 saw both in the list. **Used: the full list of 11.**

---

## 11. Open questions

- **Route Tree:** what its 3 styles and its settings are, and what the output looks like. It was never opened.
- **Printed output of the other formats:** Wristbands, Call Sheets and Playbook pages were never printed or previewed, so exact typography, header content and page size (Letter or A4) are unknown.
- **Wristband tiling:** how many wristband cards fit on one sheet, and how **Copies** fills the sheet.
- **Custom colour coding:** what "Custom" does (a colour per category or per play?) and what "Auto" colours by.
- **Label and annotation settings:** what "Compact" label style and "Large" text annotations look like.
- **Player Names = Show:** what it changes. No name text was visible in the scout card preview.
- **Copies elsewhere:** whether Call Sheets Diagrams, Playbook or Scout Cards have Copies or other settings below the visible ones.
- **Call sheet header:** where its logo and title come from, and where the scout card's "TFF" and "OPPONENT" watermarks come from (playbook or team settings?).
- **Persistence:** whether settings last between modal openings or devices. The evidence says style resets to default on reopen, and that settings are kept only within one session.
- **Category pre-selection:** whether picking a category in the playbook sidebar pre-selects it in print.
- **Default categories:** whether Run/Pass and Base/Red Zone are built-in defaults or user-created.
- **Zoom:** whether it scales the diagram inside each cell or the whole card.
- **Two-person icon:** what the two-person icon on the playbook row does.

**Not built (no data for them yet)**
- **Text annotations** (Hide · Show · Large). Plays have no text annotations to print.
- **Custom colour coding.** Only Auto (each category gets its own colour, in the side's category order; plays without a category print in black) and Off (all black).
- **Player names** (Hide · Show) on playbook pages and scout cards. There is no roster yet to take names from.

---

## 12. How our version answers them

These are the decisions the build (`src/domain/playbook/print.ts`, `src/components/playbook/Print*.tsx`) follows.

- **Entry points:** a printer button on each playbook row (first icon) and a Print button in the playbook screen header. Opened from inside a playbook, the side and category on screen are preselected.
- **Sides:** the playbook's own sides. American football adds Special teams; flag football has only Offense and Defense.
- **Live preview:** the middle column shows the real pages, scaled to fit, with zoom out/in/fit. What it shows is exactly what prints.
- **Route Tree:** one style: the coach's route tree drawn large from a player on the left half of the field, with numbered tips, plus a card for each route (number, name, drawing), for handing out.
- **Paper:** every format has a Paper setting, A4 by default in Turkish and Letter in English. Pages print at true size through `@page`, with zero margins so the browser adds no headers or footers.
- **Wristband tiling:** cards are tiled unrotated on the sheet with dashed cut lines. Copies repeat the whole set of cards, collated.
- **Call sheet header:** the team's initials and name, then the playbook, side and category, and the page number. Scout cards print the playbook name above the field and "Opponent" below it as faint watermarks.
- **Persistence:** settings, including the style, are saved per format for the workspace and come back when the print screen reopens.
- **Call sheet list groups:** one group per category, in the sidebar's order. A play filed under two categories shows under both with its one number, so each group matches the sidebar count.
- **Zoom:** zoom scales the diagram inside each cell. Zooming in keeps the backfield whole, so the far end of the routes gives way first, but it never drops a player or the side of a route: the frame stops closing in at the outermost receiver, and any zoom it cannot give makes the players and lines bigger instead.
- **Diagram frames:** each diagram uses the play's depth from the thumbnail frame, reaching further up-field for deeper routes. Compact formations, such as punt and field-goal units or a goal-line set, close in on the part of the field they use. Playbook pages stop the diagram at 1.3 : 1 (wider than tall) and leave the rest of the page blank rather than filling it with empty turf.
- **Players on paper:** tokens never print smaller than 0.065 in across at Medium (0.052 in at Small, 0.081 in at Large), so on a dense wristband the linemen overlap like a chain. Position letters smaller than 3 pt are left off.
- **Play labels:** the label bar is sized by the cell's width as well as its height. In a tall, narrow cell a name that does not fit on one line wraps onto a second one.
- **Turkish characters:** printed text lines clip sideways only, so İ Ö Ü Ğ Ş Ç and descenders are never cut.
