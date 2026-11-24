export type Cue = {start: number; end: number; text: string};

function seconds(stamp: string) {
  return stamp
    .replace(',', '.')
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0);
}

export function parseCaptions(body: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of body
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n[ \t]*\n/)) {
    const lines = block.split('\n');
    const timing = lines.findIndex((line) => line.includes('-->'));
    if (timing < 0) continue;
    const match = lines[timing].match(
      /^\s*((?:\d+:)?\d+:\d+[.,]\d+)\s*-->\s*((?:\d+:)?\d+:\d+[.,]\d+)/,
    );
    if (!match) continue;
    const text = lines
      .slice(timing + 1)
      .join('\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    const start = seconds(match[1]),
      end = seconds(match[2]);
    if (text && end > start) cues.push({start, end, text});
  }
  return cues.sort((a, b) => a.start - b.start);
}
