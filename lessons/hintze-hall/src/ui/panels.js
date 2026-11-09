import { EXHIBITS, ORDER } from '../data/exhibits.js';
import { THEME } from '../../../../shared/ui/CanvasPanel.js';

// The three panels: tour + movement on the left, the exhibit's information on the right, and a short
// "what you just did" card above.

export const PLACES = [
  { id: 'ground', label: 'Ground floor', pos: [0, 1.25, -10], look: [0, 6, 10] },
  { id: 'landing', label: 'Darwin’s landing', pos: [0, 4.5, 21.2], look: [0, 6, 25] },
  { id: 'west', label: 'West balcony', pos: [-12, 7.6, 2], look: [0, 9, 2] },
  { id: 'east', label: 'East balcony', pos: [12, 7.6, 2], look: [0, 9, 2] },
  { id: 'bridge', label: 'Bridge (1st floor)', pos: [-6, 8.1, -25], look: [0, 9, 5] },
  { id: 'second', label: 'Sequoia (2nd floor)', pos: [0, 14.7, -24], look: [0, 17, -28] },
];

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Hintze Hall', { size: 42 });
  ui.text('Natural History Museum, London', { size: 22, color: THEME.dim });
  ui.heading('Exhibits — take me there');
  ui.buttons(ORDER.map((id) => ({ id: `go-${id}`, label: EXHIBITS[id].name.replace(' statue', '').replace('Hope the blue whale', 'Hope (whale)'), active: s.selected === id, onClick: () => app.goToExhibit(id) })), { cols: 2, height: 48, size: 20, gap: 8 });
  ui.heading('Floors');
  ui.buttons(PLACES.map((p) => ({ id: `place-${p.id}`, label: p.label, onClick: () => app.goToPlace(p) })), { cols: 2, height: 48, size: 20, gap: 8 });
  ui.heading('Moving');
  ui.text(app.presenting
    ? 'Left stick: walk (up and down the stairs too). Right stick: turn. Point at any floor and pull the trigger (or pinch) to jump there. Point at an exhibit or an ⓘ for its story. B / Y: hide or show these panels.'
    : 'W A S D or the arrow keys: walk. Drag to look around. Click a floor to go there; click an exhibit or an ⓘ for its story. H: hide or show these panels.', { size: 21, color: THEME.dim });
  ui.buttons([
    { id: 'turn', label: `Turn: ${app.turnLabel()}`, onClick: () => app.cycleTurn() },
    { id: 'markers', label: s.markers ? 'Markers: on' : 'Markers: off', active: s.markers, onClick: () => app.toggleMarkers() },
  ], { height: 48, size: 20, gap: 8 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 50, size: 20, gap: 8 });
}

export function drawInfo(ui, app) {
  const id = app.state.selected;
  if (!id) {
    ui.title('Welcome', { size: 38 });
    ui.text('This is Hintze Hall, the great central hall of the Natural History Museum in London, recreated from a 3D scan.', { size: 23 });
    ui.text('Explore all three floors: walk up the main staircase to Charles Darwin and along both balconies. To reach the giant sequoia on the second floor, point at it and jump, or use the “Sequoia (2nd floor)” button.', { size: 23 });
    ui.text('Every ⓘ marks an exhibit. Point at it (or click it) to discover its story.', { size: 23, color: '#ffd166' });
    return;
  }
  const e = EXHIBITS[id];
  ui.title(e.name, { size: 34 });
  ui.text(e.kind, { size: 21, color: THEME.dim });
  ui.kv('Where', e.floor, { size: 20 });
  ui.gap(4);
  for (const f of e.facts) ui.text(`• ${f}`, { size: 21 });
  ui.gap(4);
  ui.box(`Did you know? ${e.didYouKnow}`, { size: 20, color: '#ffd166' });
}

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  ui.y = 26;
  ui.text('MUSEUM GUIDE', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 31, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(2);
  ui.text(e.text, { size: 25, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
