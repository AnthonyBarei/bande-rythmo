// Export format badge colors — one color per family (FIXES_R5 #13).
// Hex mirrors of index.css so `color + 'aa'` alpha suffixes keep working.
// Red stays reserved for failures: no format family uses danger.
export const FAMILY_COLORS = {
  video:     '#5EC27C', // success
  gif:       '#A98BF0', // violet
  subtitles: '#5AA9F0', // info
  studio:    '#FF9944', // orange
  audio:     '#F06AA0', // pink
}

export const FORMAT_FAMILY = {
  mp4: 'video', 'mp4-dubbed': 'video', dubpack: 'video',
  gif: 'gif',
  srt: 'subtitles', ass: 'subtitles', 'ass-karaoke': 'subtitles',
  detx: 'studio', croisille: 'studio',
  mp3: 'audio', wav: 'audio',
}

export const NEUTRAL_FORMAT_COLOR = '#A6A6AE'

export const formatColor = id => FAMILY_COLORS[FORMAT_FAMILY[id]] || NEUTRAL_FORMAT_COLOR
