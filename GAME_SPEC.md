# GAME_SPEC – „Formelmagier“ (Physik-Lern-RPG)

> Verbindliche Spezifikation. Der Task-Plan mit Status steht in `TASKS.md`.

## Rolle & Ziel

Ein **2D-Rollenspiel im Browser**, mit dem man **Physik lernt**. Der Spieler ist ein **Zauberlehrling**, der physikalische **Formeln als Zaubersprüche** einsetzt, um Rätsel zu lösen, Gegner zu besiegen und sich auszurüsten.

Inhaltliche Grundlage: Skriptum **„Physik – Umwelt- und Bioressourcenmanagement“ (BOKU Wien, Institut für Physik und Materialwissenschaft, Ausgabe Oktober 2024)**. **10 Level** nach der Kapitelstruktur. Zielgruppe: Studierende im 1. Semester (Prüfungsvorbereitung).

**Alle Erklärtexte, Dialoge und Aufgaben in eigenen Worten** – keine Textpassagen aus dem Skriptum kopieren.

## Tech-Stack

- TypeScript + Vite + Phaser 3 (2D, Szenen-System)
- Lerninhalte datengetrieben in JSON (`src/content/levels/level-01.json` …)
- Spielstand in `localStorage` (mit try/catch abgesichert)
- Pixel-Art-Stil mit Platzhalter-Grafiken, später austauschbar
- Sprache: Deutsch, Dezimalkomma akzeptieren (`2,39` und `2.39`)
- `npm run dev` lokal, Build als statische Seite

## Kern-Mechanik: Formeln sind Zauber

1. **Grimoire:** Jede gelernte Formel ist ein Zauber mit Name, Formel, Formelzeichen und SI-Einheiten.
2. **Zauber wirken:** Zauber wählen, Werte aus der Situation einsetzen (inkl. Einheit), Ergebnis eingeben.
3. **Einheiten-Magie:** Einheiten-Engine über den 7 SI-Basiseinheiten (m, kg, s, A, K, cd, mol) + Vorsilben (µ, m, c, d, k, M, G …).
   - Falsche Einheit → Zauber **verpufft** (mit Hinweis, welche Dimension fehlt)
   - Richtige Zahl, falsche Größenordnung → Zauber **trifft schwach**
   - Toleranz ±1 % (pro Aufgabe einstellbar)
4. **Mana:** Jeder Zauber kostet Mana, Fehlversuche extra. Regeneration durch Lernkarten-Quiz.
5. **Hilfesystem in 3 Stufen:** Hinweis → Lösungsweg-Skizze → vollständige Lösung (weniger XP).
6. **Kombo-Zauber** ab Level 3: zwei Formeln verketten.

## Ausrüstung & Fortschritt

- **XP & Rang:** Lehrling → Adept → Magier → Erzmagier → Großmeister der Elemente
- **Ausrüstung mit Lerneffekt:** Zauberstab der Vorsilben (Umrechnungsfaktoren), Brille der Dimensionen (SI-Basiseinheiten einer Eingabe), Robe der Gelassenheit (1 Fehlversuch pro Kampf ohne Verlust), Amulett der Konstanten (c, h, e, k_B, N_A, g …)
- **Shop** beim Händler-NPC, bezahlt mit Gold aus gelösten Aufgaben
- **Codex/Formelsammlung** wächst mit jedem Level, jederzeit abrufbar

## Die 10 Level

Jedes Level: eigene Region, **Mentor-NPC** mit kurzer Theorie (max. 5 Sätze pro Dialog), **6–10 Aufgaben**, **ein Boss** als Abschlussprüfung, **neue Zauber**.

| Level | Kapitel | Welt | Inhalte | Boss |
|---|---|---|---|---|
| 1 | 1 Einleitung | Akademie der Maße | Größe = Zahlenwert × Einheit, 7 SI-Basiseinheiten, abgeleitete Einheiten, Umrechnen, Skalar/Vektor, Mittelwert, Standardabweichung, Gauß (68,3/95,4/99,7 %) | Messfehler-Golem |
| 2 | 2 Kinematik | Windpfade | Translation (v, a, gleichförmig/gleichmäßig beschleunigt, freier Fall), Rotation (ω, α, Drehzahl, Frequenz) | Der rasende Wirbelgeist |
| 3 | 3 Kraft | Schmiede der Kräfte | Masse & Dichte, Impuls, Newton'sche Axiome, Gravitation, Kräftegleichgewicht, Reibung, Kreisbewegung, Druck, Schweredruck, Strömungswiderstand | Der Tiefsee-Kraken |
| 4 | 4 Drehmoment | Turm der Hebel | Kräftepaar, Drehmoment, Trägheitsmoment, Gleichgewicht, Statik, Schwerpunkt, Drehimpuls | Der kippende Riese |
| 5 | 5 Arbeit, Energie, Leistung | Minen von Joule | Hub-, Reibungs-, Beschleunigungsarbeit, Energieformen, Energieerhaltung, Leistung | Der Energievampir |
| 6 | 6 Energieeinsatz & -gewinnung | Tal der Kraftwerke | Energieverbrauch Österreich, Exergie, Lauf-/Pumpspeicher, Windkraft, Solarenergie | Der Blackout-Drache |
| 7 | 7 Elektrizität & Magnetismus | Gewitterzitadelle | Ladung, Coulomb, Feld & Potenzial, Strom, Ohm, Kirchhoff, Schaltungen, Kondensator, Magnetfeld, Lorentz, Induktion, Wechselstrom, Transformator, Drehstrom, p-n-Übergang | Der Kurzschluss-Dämon |
| 8 | 8 Wärmeenergie | Feuerberge | Temperatur, Ausdehnung, innere Energie, Wärme, Enthalpie, 1. Hauptsatz, ideale Gase, Wärmekapazität, Luftdruck | Der Salamander-Fürst |
| 9 | 9 + 11 | Nebelsümpfe | Zustandsdiagramme, Dampfdruck, Phasenübergänge, Luftfeuchte, Konvektion, Wärmeleitung, Wärmedurchgang, Wärmestrahlung | Die Nebelhexe |
| 10 | 10 Wärmekraftmaschinen | Das Carnot-Heiligtum | Volumsänderungsarbeit, Carnot, Wirkungsgrad, 2. Hauptsatz, Dampfmaschine, Stirling, Turbine, Diesel, Otto, Gasturbine, Wärmepumpe, Kältemaschine | Der Ewige Motor |

Ein Level wird erst freigeschaltet, wenn der Boss des vorherigen besiegt ist. Gespielte Level können wiederholt werden (Training).

## Aufgabenformat (JSON)

Jede Aufgabe: `id`, `story`, `given` (Werte mit Einheit), `spells` (erlaubte Formeln), `answer` (Wert + Einheit), `tolerance`, `hints[3]`, `solutionSteps[]`, `xp`, `gold`. Zusätzlich: `solution` (Musterlösung als Zauber mit eingesetzten Werten – wird automatisch nachgerechnet), optional `requireSI`, `commonMistakes`. Details: `src/content/types.ts`.

## Didaktische Regeln

- Erst Story-Situation, dann Formel, dann Rechnung – nie nackte Rechenaufgaben
- Nach jedem Level eine Lernkarten-Runde (Spaced Repetition)
- Fehler erklären, nicht bestrafen: bei Einheitenfehlern genau zeigen, wo die Dimension nicht passt
- Statistik-Seite: welche Themen sitzen, welche nicht
- Optionaler Prüfungsmodus pro Level: 5 zufällige Aufgaben ohne Hilfen, mit Zeitlimit

## Vorgehen in Phasen

1. **Fundament:** Projekt, Einheiten-Engine mit Unit-Tests, JSON-Schema
2. **Vertikaler Prototyp:** Level 1 komplett spielbar
3. **Feedback-Runde** zu Level 1 – erst danach weiter
4. **Level 2–10** nacheinander, nach jedem Level stoppen und zusammenfassen
5. **Feinschliff:** Sound, Animationen, Statistik, Prüfungsmodus

Alle physikalischen Lösungen in den JSON-Dateien werden per Test-Skript (`npm run verify`) geprüft, bevor sie eingebaut werden.
