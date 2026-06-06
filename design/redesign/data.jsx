/* Shared mock data for the redesign prototype */
(function () {
  const { T } = window.RD;

  const CLIPS = [
    { id: 1, name: 'S02E04 — confrontation cuisine', dur: 41.2, repl: 14, status: 'dubbing', chars: ['LÉA', 'MARC', 'SARAH'], hue: 18 },
    { id: 2, name: 'S02E04 — réveil dans la grange', dur: 27.6, repl: 8, status: 'todo', chars: ['LÉA', 'NOAH'], hue: 210 },
    { id: 3, name: 'S02E03 — annonce du capitaine', dur: 52.0, repl: 21, status: 'review', chars: ['MARC', 'SARAH'], hue: 330 },
    { id: 4, name: 'S01E12 — le grand final', dur: 64.8, repl: 32, status: 'done', chars: ['LÉA', 'MARC', 'SARAH', 'NOAH'], hue: 140 },
    { id: 5, name: 'Réaction — Léa surprise', dur: 4.2, repl: 1, status: 'todo', chars: ['LÉA'], hue: 48 },
    { id: 6, name: 'S02E05 — la nuit tombe', dur: 38.4, repl: 17, status: 'dubbing', chars: ['NOAH', 'MARC'], hue: 270 },
  ];

  const STATUS = {
    todo:    { label: 'À faire',   color: T.text3,   bg: T.surface2 },
    dubbing: { label: 'Doublage',  color: T.accent,  bg: 'rgba(245,197,24,.14)' },
    review:  { label: 'À revoir',  color: T.info,    bg: 'rgba(90,169,240,.14)' },
    done:    { label: 'Validé',    color: T.success, bg: 'rgba(94,194,124,.14)' },
  };

  // subtitles for the editor — start/end in seconds, per-word timing, character
  const SUBS = [
    { i: 0, char: 'LÉA',   start: 1.0,  end: 2.6,  text: 'Attends — quelque chose ne va pas.', take: true },
    { i: 1, char: 'MARC',  start: 3.0,  end: 4.2,  text: 'De quoi tu parles ?' },
    { i: 2, char: 'LÉA',   start: 4.6,  end: 6.8,  text: 'Regarde la porte. Elle était fermée.' },
    { i: 3, char: 'SARAH', start: 7.2,  end: 8.0,  text: '(souffle)' },
    { i: 4, char: 'MARC',  start: 8.4,  end: 11.0, text: 'On devrait peut-être appeler quelqu\u2019un, non ?' },
    { i: 5, char: 'LÉA',   start: 11.4, end: 13.2, text: 'Pas le temps. Viens.', note: 'ton pressé, à voix basse' },
    { i: 6, char: 'SARAH', start: 13.6, end: 15.4, text: 'Et si c\u2019était un piège ?' },
    { i: 7, char: 'NOAH',  start: 15.8, end: 17.2, text: 'C\u2019est forcément un piège.' },
  ];

  const JOBS_RUN = [
    { kind: 'transcribe', icon: 'mic',     title: 'Transcription Whisper', clip: 'S02E04 — confrontation', stage: 'Segment 8 / 13', pct: 62, eta: '14s' },
    { kind: 'export',     icon: 'film',    title: 'Export MP4 + BR',        clip: 'S02E04 — réveil grange', stage: 'Supersample 4 · incrustation', pct: 34, eta: '48s' },
    { kind: 'remux',      icon: 'download',title: 'Remux piste audio · Plex',clip: 'Une_episode_brut.mp4',   stage: 'FR 5.1 → stéréo', pct: 18, eta: '2min 10s' },
  ];
  const JOBS_DONE = [
    { icon: 'film',    title: 'Export MP4 + BR',        clip: 'S01E12 — final',    file: 'S01E12_bande_rythmo.mp4', size: '84.2 MB', when: '14:22', action: 'download' },
    { icon: 'mic',     title: 'Transcription Whisper',  clip: 'S02E03 — annonce',  file: '21 répliques',            size: null,      when: '14:08', action: 'open' },
    { icon: 'layers',  title: 'Export GIF',             clip: 'Réaction Léa',      file: 'reaction_lea.gif',        size: '3.1 MB',  when: '13:51', action: 'download' },
  ];

  const PLEX = [
    { title: 'Une_episode_brut', year: 2024, dur: '42min', genre: 'Série · S02E04', mine: true },
    { title: 'L\u2019île au Trésor', year: 2024, dur: '1h47', genre: 'Aventure' },
    { title: 'Nuit Sombre', year: 2023, dur: '2h12', genre: 'Drame' },
    { title: 'Le Voyage', year: 2022, dur: '1h32', genre: 'Documentaire' },
    { title: 'Sous le Ciel', year: 2024, dur: '1h58', genre: 'Drame' },
    { title: 'Loin des Plaines', year: 2021, dur: '2h05', genre: 'Western' },
    { title: 'La Grande Évasion', year: 2023, dur: '2h22', genre: 'Action' },
    { title: 'Au Bord du Monde', year: 2024, dur: '1h18', genre: 'Court' },
  ];

  const TAKES = [
    { n: 3, label: 'Prise 3', dur: 2.4, best: true,  level: 0.82 },
    { n: 2, label: 'Prise 2', dur: 2.6, best: false, level: 0.64 },
    { n: 1, label: 'Prise 1', dur: 2.5, best: false, level: 0.71 },
  ];

  window.RDATA = { CLIPS, STATUS, SUBS, JOBS_RUN, JOBS_DONE, PLEX, TAKES };
})();
