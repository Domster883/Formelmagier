# ⚗ Formelmagier

Ein Physik-Lern-Rollenspiel im Browser: Formeln sind Zaubersprüche, Einheiten sind Magie.
Kapitelstruktur nach der Lehrveranstaltung „Physik“ (Umwelt- und Bioressourcenmanagement, BOKU Wien). Alle Texte sind in eigenen Worten geschrieben.

## Starten

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Einheiten-Engine + Prüfung aller Level-Inhalte
npm run build      # statische Seite in dist/ (relativ verlinkt, überall hostbar)
```

## Steuerung

| Aktion | Taste |
|---|---|
| Bewegen | Pfeiltasten / WASD oder auf die Karte klicken |
| Sprechen / Untersuchen / Kämpfen | E, Leertaste, Enter oder Figur anklicken |
| Grimoire / Meditieren / Statistik / Weltkarte | G / L / T / M |
| Fenster schließen | Esc |

## So funktioniert ein Zauber

1. Zauber aus dem Grimoire wählen (z. B. *Fluxus* `q = m / (A · t)`).
2. Gegebene Werte **mit Einheit** einsetzen (`112` `g`, `13` `dm²`, `1` `h`). Mit „⇩ einsetzen“ landet ein gegebener Wert im zuletzt angeklickten Feld.
3. Ergebnis mit Einheit angeben (`2,39e-4` `kg/(m²·s)`).

- Falsche Dimension → **verpufft**, mit Erklärung, was fehlt („durch eine Zeit teilen (s⁻¹)“)
- Richtige Ziffern, falsche Zehnerpotenz → **trifft schwach**
- Innerhalb der Toleranz (Standard ±1 %) → **Volltreffer**

Einheiten-Schreibweisen: `m²`, `m^2`, `m2`; `·`, `*` oder Leerzeichen für Multiplikation; alles nach `/` steht im Nenner (`kg/m²s` = `kg/(m²·s)`). Zahlen: `2,39`, `2.39`, `2,39e-4`, `2,39·10^-4`.

## Inhalte bearbeiten (ohne Code)

Alles Lernmaterial steht in `src/content/levels/level-XX.json`:

- `mentor.lessons` – Lektionen (max. 5 Sätze), `unlocks` = freigeschaltete Zauber
- `spells` – Zauber: Anzeigeformel, auswertbare Formel (`expr`), Variablen mit erwarteter Einheit
- `tasks` – Aufgaben (`numeric` oder `choice`): Story, Gegebenes, erlaubte Zauber, Antwort, Toleranz, 3 Hinweise, Lösungsweg, XP, Gold, Musterlösung, typische Fehler
- `encounters` – wo auf der Karte welche Aufgaben warten (Kristall, Monster, Boss)
- `map` – ASCII-Karte; Zeichen laut `legend`, dazu Marker für Mentor, Händler, Start (`P`) und Begegnungen
- `flashcards` – Lernkarten

**Vor jedem Einbau:** `npm test` ausführen. Der Test rechnet jede Musterlösung mit der Einheiten-Engine nach **und** vergleicht sie mit einer unabhängigen Kontrollrechnung in `tests/content.test.ts` (für neue Aufgaben dort ergänzen).

## Projektstruktur

```
src/engine/   Einheiten-Engine (units.ts) und Formel-Auswerter (expr.ts)
src/content/  Level-JSONs, Ausrüstung, Konstanten, Typen
src/game/     Phaser-Szene (Karte), Spielstand, Platzhalter-Grafiken
src/ui/       Dialoge, Kampf/Zauber-Eingabe, Grimoire, Shop, Lernkarten, Statistik
tests/        Unit-Tests und Inhaltsprüfung
```

Siehe auch `GAME_SPEC.md` (Spezifikation) und `TASKS.md` (Fortschritt).
