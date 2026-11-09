// Prints the phase breakdown of a --trace load, one line per boundary, so the report can
// say where a load's milliseconds go. Usage: node tools/trace-phases.mjs results/trace/*.json
//
// The marks come from load.marks (harness: load boundaries + Mol* state-build cells, with
// usedJSHeap) and from the worker records (sent/received message timestamps). 1 rep per run is
// enough; the traced runs are not part of the committed medians.
import fs from 'node:fs';

const round = (ms) => Math.round(ms * 10) / 10;

function firstWorkerMessage(workers, direction, kind) {
  for (const worker of workers) {
    for (const message of worker[direction] ?? []) if (message.kind === kind) return { worker, message };
  }
  return null;
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node tools/trace-phases.mjs results/trace/*.json');
    process.exitCode = 1;
    return;
  }
  for (const file of files) {
    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entry = result.scenarios.find((scenario) => scenario.reps.some((rep) => rep.load?.marks?.length));
    if (!entry) {
      console.log(file + ': no traced rep');
      continue;
    }
    const rep = entry.reps.find((candidate) => candidate.load?.marks?.length);
    const load = rep.load;
    const marks = load.marks;
    const start = marks.find((mark) => mark.name === 'load:start').ms;
    const workers = rep.diagnostics?.inst?.workers ?? [];
    const row = (label, ms, extra) =>
      console.log(
        '  ' + label.padEnd(42) + String(round(ms)).padStart(9) + ' ms' + (extra ? '   ' + extra : ''),
      );

    console.log('');
    console.log(file + '  ' + result.coreVersion + '  ' + (result.gpuMode ?? '?') + '  load ' + load.readyMs + ' ms'
      + '  loadAvg1 ' + (rep.loadAvg1 ?? '?'));

    // Boundaries: load marks and worker messages on one timeline.
    const timeline = marks.map((mark) => ({ label: mark.name + (mark.detail ? ' ' + mark.detail : ''), ms: mark.ms - start, heap: mark.heap }));
    for (const [direction, verb] of [['sent', 'page → worker'], ['received', 'worker → page']]) {
      for (const worker of workers) {
        for (const message of worker[direction] ?? []) {
          timeline.push({ label: verb + ' ' + message.kind, ms: message.ms - start, heap: null });
        }
      }
    }
    timeline.sort((a, b) => a.ms - b.ms);
    for (const item of timeline) {
      console.log('  ' + String(round(item.ms)).padStart(8) + '  ' + item.label + (item.heap ? '   heap ' + Math.round(item.heap / 1e6) + ' MB' : ''));
    }

    // Named phases the report quotes.
    const phase = (fromLabel, toLabel) => {
      const from = timeline.find((item) => item.label.includes(fromLabel));
      const to = timeline.find((item) => item.label.includes(toLabel) && (!from || item.ms >= from.ms));
      return from && to ? to.ms - from.ms : null;
    };
    console.log('  phases:');
    const parse = phase('cell:created volume-representation-3d', 'cell:created molstudio-downsample-volume');
    const post = firstWorkerMessage(workers, 'sent', 'downsample');
    const reply = firstWorkerMessage(workers, 'received', 'downsampled');
    const init = firstWorkerMessage(workers, 'sent', 'init');
    const ready = firstWorkerMessage(workers, 'received', 'ready');
    if (post) row('page staging to downsample request', post.message.ms - start);
    if (post && reply) row('worker downsample round trip', reply.message.ms - post.message.ms);
    if (parse !== null) row('parse-time representation → decorator commit', parse);
    if (init && ready) row('engine start (init → ready)', ready.message.ms - init.message.ms);
    const removed = marks.find((mark) => mark.name === 'cell:removed');
    const rebuilt = marks.find((mark) => mark.name === 'cell:created volume-representation-3d' && (!removed || mark.ms >= removed.ms));
    if (removed && rebuilt) row('delete + rebuild parsed representation', rebuilt.ms - removed.ms);
    const resolved = marks.find((mark) => mark.name === 'load:resolved');
    if (rebuilt && resolved) row('rebuild → load resolved', resolved.ms - rebuilt.ms);
  }
}

main();
