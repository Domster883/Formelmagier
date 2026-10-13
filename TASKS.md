# Task-Plan

## Phase 1 – Fundament ✅
- [x] Vite + TypeScript + Phaser 3, Ordnerstruktur
- [x] Einheiten-Engine `src/engine/units.ts`: 7 Basiseinheiten, Vorsilben p…T, abgeleitete Einheiten (N, J, W, Pa, Hz, C, V, Ω, F, T …), Sondereinheiten (h, min, Jahr, ha, L, t, kp, kpm, kcal, Wh, bar …), Dimensionsvergleich, Fehlererklärung, Dezimalkomma, Zehnerpotenzen
- [x] Formel-Auswerter `src/engine/expr.ts` (rechnet mit Einheiten, inkl. mean/std/sqrt)
- [x] Unit-Tests `tests/units.test.ts`
- [x] JSON-Schema als TypeScript-Typen `src/content/types.ts`
- [x] Inhalts-Prüfung `tests/content.test.ts` (Musterlösung per Zauber nachgerechnet + unabhängige Kontrollrechnung + Strukturchecks)

## Phase 2 – Vertikaler Prototyp (Level 1) ✅
- [x] Begehbare Karte (Tastatur + Klick/Tippen), Akademie der Maße
- [x] Mentorin mit 4 Lektionen (≤ 5 Sätze), schaltet 8 Zauber frei
- [x] 5 Begegnungen + Boss, 20 Aufgaben (Auswahl- und Rechenaufgaben)
- [x] Zauber-Eingabe: Zauber wählen → Werte mit Einheit einsetzen → Ergebnis; verpufft / trifft schwach / Volltreffer
- [x] 3-stufige Hilfe mit XP-Abzug, typische Fehler mit eigener Erklärung
- [x] XP, Ränge, Gold, Mana, Lebenspunkte, Robe-Effekt
- [x] Shop mit 4 Ausrüstungsgegenständen (Stab, Brille, Robe, Amulett)
- [x] Grimoire/Codex (Zauber, Theorie, Einheiten-Labor, Vorsilben, Konstanten)
- [x] Lernkarten (Leitner) – Meditieren für Mana, Runde nach dem Boss
- [x] Statistik pro Thema
- [x] Speichern/Laden (localStorage, automatisch)
- [x] Weltkarte mit 10 Regionen, Freischaltung über Bosse, Training

## Phase 3 – Feedback zu Level 1 ⏳
- [x] Konventionen bestätigt: n − 1, 1 Jahr = 365 d, g = 9,81 m/s²
- [x] „Mühsam ist gewollt“: Einsetzen-Knopf entfernt, erwartete SI-Einheit nur noch mit Brille sichtbar
- [x] Übungsschrein: Leitner-Wiederholung gelöster Aufgaben, HUD-Anzeige „fällig“
- [ ] Skriptum-PDF ins Repo (`docs/`) – öffentlich nicht auffindbar, kommt vom Nutzer
- [ ] Demo-Feedback einarbeiten

## Phase 4 – Level 2–10
- [ ] Level 2 Windpfade (Kinematik)
- [ ] Level 3 Schmiede der Kräfte (+ Kombo-Zauber)
- [ ] Level 4 Turm der Hebel
- [ ] Level 5 Minen von Joule
- [ ] Level 6 Tal der Kraftwerke
- [ ] Level 7 Gewitterzitadelle
- [ ] Level 8 Feuerberge (°C als absolute Temperatur in der Engine ergänzen)
- [ ] Level 9 Nebelsümpfe
- [ ] Level 10 Carnot-Heiligtum

## Phase 5 – Feinschliff
- [ ] Sound & Musik
- [ ] Animationen (Zauber-Effekte auf der Karte)
- [ ] Prüfungsmodus (5 Zufallsaufgaben, keine Hilfen, Zeitlimit)
- [ ] Statistik erweitern (Verlauf, Export)
