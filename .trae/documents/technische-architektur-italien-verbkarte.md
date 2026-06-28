## 1. Architekturdesign
```mermaid
flowchart TD
    A["Nutzeroberfläche im Browser"] --> B["React-Anwendung"]
    B --> C["Kartenmodul mit Leaflet"]
    B --> D["Zustandsverwaltung für Orte und Filter"]
    B --> E["Import-/Exportmodul"]
    B --> F["Supabase-Client"]
    F --> G["Supabase Postgres"]
    F --> H["REST-API und Auth-Kontext"]
    E --> I["CSV/XLSX-Dateien"]
    C --> J["OpenStreetMap-Kachelquelle"]
```

## 2. Technologiebeschreibung
- Frontend: `React 18` + `TypeScript` + `Vite`
- Styling: `Tailwind CSS 3` mit zusätzlichen CSS-Variablen für thematische Farben
- Kartenbibliothek: `Leaflet` + `react-leaflet`
- Datenaustausch: `xlsx` für Excel-Export, nativer CSV-Export für einfache Weitergabe
- Backend as a Service: `Supabase`
- Persistenz: zentrale Speicherung in `Supabase Postgres`
- Initialisierung: `Vite`

## 3. Routen-Definition
| Route | Zweck |
|-------|-------|
| / | Hauptansicht mit Karte, Filtern, Ortsliste und Befundformular |

## 4. API-Definitionen
Die Anwendung nutzt Supabase direkt aus dem Frontend. In der ersten Mehrbenutzer-Version erfolgt die Bearbeitung ohne Login; Schreib- und Leserechte werden daher fuer den `anon`-Rollenpfad freigegeben.

```ts
export type VerbKategorie = 'ar' | 're_ri' | 'beide' | 'unklar' | 'keine_daten';

export interface Stadtbefund {
  id: string;
  ort: string;
  region: string;
  breitengrad: number;
  laengengrad: number;
  kategorie: VerbKategorie;
  belegform: string;
  lemma: string;
  quelle: string;
  kommentar: string;
  status: 'offen' | 'geprueft';
  aktualisiertAm: string;
}

export interface Filterzustand {
  suche: string;
  region: string;
  kategorien: VerbKategorie[];
  status: 'alle' | 'offen' | 'geprueft';
}
```

```ts
export interface SupabaseStadtbefundRow {
  id: string;
  ort: string;
  region: string;
  breitengrad: number;
  laengengrad: number;
  kategorie: VerbKategorie;
  belegform: string | null;
  lemma: string | null;
  quelle: string | null;
  kommentar: string | null;
  status: 'offen' | 'geprueft';
  erstellt_am: string;
  aktualisiert_am: string;
}
```

## 5. Datenmodell
### 5.1 Datenmodell-Definition
```mermaid
erDiagram
    STADTBEFUND {
        string id
        string ort
        string region
        float breitengrad
        float laengengrad
        string kategorie
        string belegform
        string lemma
        string quelle
        string kommentar
        string status
        string aktualisiertAm
    }
```

### 5.2 Daten- und Speicherlogik
- Alle Datensätze werden als Array von `Stadtbefund`-Objekten im Browser gehalten.
- Die Quelldaten liegen zentral in der Tabelle `stadtbefunde` in Supabase.
- Beim Start lädt das Frontend alle Datensätze aus Supabase und mappt sie in das Frontend-Modell.
- Änderungen werden per `insert`, `update` und `delete` direkt nach Supabase geschrieben.
- Export erzeugt aus dem aktuellen Datenbestand eine `CSV`- oder `XLSX`-Datei mit sprechenden Spaltennamen.
- Fuer die erste Teamversion wird bewusst auf Login verzichtet, damit Kolleginnen sofort gemeinsam arbeiten koennen.

## 6. Komponentenstruktur
- `AppShell`: Layout, Kopfbereich und globale Steuerung.
- `ItalyMap`: Leaflet-Karte, Marker, Popups und Kartenlegende.
- `FilterPanel`: Suchfeld, Kategorie- und Statusfilter, Regionseinschränkung.
- `LocationTable`: gefilterte tabellarische Ortsliste mit Auswahlzustand.
- `EntryForm`: Formular für Erfassung und Bearbeitung eines Befunds.
- `StatsBar`: Kennzahlen pro Kategorie und Gesamtmenge.
- `exportUtils`: CSV/XLSX-Erzeugung und Dateinamenlogik.
- `supabaseClient`: Initialisierung des Supabase-Clients mit Projekt-URL und `anon`-Key.
- `entryRepository`: Laden, Speichern und Loeschen der zentralen Datensaetze.

## 7. Qualitäts- und Umsetzungsentscheidungen
- Desktop-first, da die primäre Nutzung im Forschungs- und Büro-Kontext erfolgt.
- Die zentrale Datenbank liegt in Supabase, damit mehrere Personen denselben Datenbestand nutzen.
- Markerfarben und Legende müssen für die Kategorien konsistent und kontrastreich sein.
- Alle Kernfunktionen benoetigen fuer Laden und Speichern eine Internetverbindung zur Supabase-API; Kartenkacheln kommen weiterhin von OpenStreetMap.
- RLS und Rechte muessen explizit fuer den `anon`-Zugriff gesetzt werden, da die App zunaechst ohne Login arbeitet.
