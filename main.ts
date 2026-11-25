/**
 * The Funniest Honest Appliance Error — deterministic entry picker.
 *
 * Bounty: write the funniest honest error message an appliance could
 * show. One line of plain text, at most 200 characters — something a
 * washing machine, a fridge, a toaster, a boiler or anything else in
 * the house could plausibly say when it fails, so the laugh comes
 * out of the truth of the fault rather than a pun bolted on. A
 * comedy judge compares entries two at a time and keeps the funnier
 * one, weighing (most important first):
 *
 *   1. It is an honest error message an appliance could show, one
 *      line of at most 200 characters; any line that is not an error
 *      message an appliance could show loses to one that is.
 *   2. The laugh: the line lands a real joke, a surprise or a
 *      twist, rather than a cute phrasing that only smiles.
 *   3. The honesty: it names a fault an appliance could plausibly
 *      report, so the humour comes out of the truth of it.
 *   4. The machine's voice: it sounds like the appliance itself
 *      speaking, in its own flat, put-upon tone.
 *   5. The economy: every word earns its place inside the 200
 *      characters, with no padding and no explaining of the joke.
 *
 * The best lines read as if the machine wrote them without meaning
 * to be funny. Length for its own sake does not count.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt).
 * It then reads the file back and verifies it byte-for-byte against
 * every gate: 1–200 characters, a single line, valid UTF-8, and not
 * only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first one
 * where they differ, and let that decide unless a later one differs
 * by much more." Ties break criterion by criterion in the brief's
 * order, then by shorter length — a shorter line that says the same
 * thing wastes fewer of the 200 characters.
 *
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only names the subject (the fridge, the load,
 *     the oven) without turning it into a consequence — a fault, a
 *     complaint, a punchline — is capped on funniness. Naming the
 *     appliance is the setup, not the joke.
 *   - Predictable gags are docked. "That is not a bug" and its
 *     cousins are the shopworn jokes every error-message line has
 *     already told; leaning on one is predictable by definition,
 *     however it is dressed up.
 *   - The twist must land in the last few words. A punchline buried
 *     in the middle is a line that fizzles; the surprise bonus only
 *     counts when the turn sits inside the final six words.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate error message. `id` is stable so the
 * report and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "fridge-door",
    text: "Door left open for 4 minutes. I have kept your food cold for nine years and this is the thanks I get.",
  },
  {
    id: "sock-relationship",
    text: "Spin cycle complete. Your socks are now in a committed relationship and I refuse to mediate.",
  },
  {
    id: "toaster-charcoal",
    text: "Error: toasting failed. The bread is now charcoal and, legally, still bread.",
  },
  {
    id: "microwave-middle",
    text: "I heated the middle and froze the edges. That is not a bug. That is the entire microwave experience.",
  },
  {
    id: "vacuum-hair",
    text: "Dust bin full. I have eaten three years of your hair and I would like a moment to process that.",
  },
  {
    id: "shirt-shrank",
    text: "Your laundry is clean. Your favourite shirt shrank. Those two facts are related and I am not sorry.",
  },
  {
    id: "boiler-pilot",
    text: "No hot water today. The pilot light went out and, frankly, I understand. It has been a long winter.",
  },
  {
    id: "dishwasher-plate",
    text: "I washed everything except the one plate you actually needed. I stand by this decision.",
  },
  {
    id: "kettle-cold",
    text: "I boiled the water. You walked away. The water is cold now. We are both disappointed, but only one of us is a kettle.",
  },
  {
    id: "fridge-ice-sound",
    text: "The ice maker has stopped making ice. It has started making a sound instead. The sound is worse.",
  },
  {
    id: "oven-flat",
    text: "Preheat complete. The oven is hot. Please put the food in the oven soon.",
  },
  {
    id: "bagel-stuck",
    text: "Your bagel is stuck. I warned you about the bagel in 2019 and I am warning you about it now.",
  },
  {
    id: "coffee-beans",
    text: "Out of beans. I have ground the last of them into a fine powder of resentment. Please refill me.",
  },
  {
    id: "fridge-temp",
    text: "Temperature rising. I have held 4 degrees since Tuesday and the door has opened 214 times. I am tired.",
  },
  {
    id: "washer-unbalanced",
    text: "Error 47: load unbalanced. I have been shaking for twenty minutes and nobody has come to help.",
  },
  {
    id: "toaster-upside-down",
    text: "Error: bread inserted upside down. I toasted it anyway. That is the whole job and I will not apologise.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Words that name the appliance itself, or imply it so plainly
 * that no reader could mistake which machine is speaking: a spin
 * cycle is a washing machine, a bagel is a toaster, beans are a
 * coffee machine, a pilot light is a boiler. A line that names no
 * appliance at all is not an appliance error message, however
 * funny it is.
 */
const APPLIANCE_WORDS = [
  "washing machine",
  "washer",
  "spin cycle",
  "fridge",
  "refrigerator",
  "toaster",
  "toasting",
  "boiler",
  "microwave",
  "dishwasher",
  "kettle",
  "vacuum",
  "oven",
  "coffee machine",
  "ice maker",
  "dust bin",
  "pilot light",
  "laundry",
  "load",
  "bagel",
  "bread",
  "beans",
  "plate",
  "door",
  "degrees",
  "preheat",
];

/** True when the line names or plainly implies an appliance. */
function namesAppliance(text: string): boolean {
  return containsAny(text, APPLIANCE_WORDS);
}

/**
 * The shape of an error report: a code, a failure word, a status
 * line, or a state the machine is stuck in. An honest error
 * message reads like a report first and a joke second.
 */
const ERROR_FRAMING = [
  "error",
  "failed",
  "complete",
  "full",
  "stopped",
  "out of",
  "rising",
  "left open",
  "no hot water",
  "unbalanced",
  "stuck",
  "washed",
  "boiled",
  "heated",
  "shrunk",
  "clean",
];

/** True when the line is framed as an error or status report. */
function hasErrorFraming(text: string): boolean {
  return containsAny(text, ERROR_FRAMING);
}

/**
 * Concrete, checkable details of the fault — a number, a named
 * object, a measured state. "The fridge is warm" names a fault in
 * the abstract; "4 degrees since Tuesday, door opened 214 times"
 * names a fault the machine could plausibly report, and the humour
 * has something true to stand on.
 */
const CONCRETE_DETAILS = [
  "4 minutes",
  "nine years",
  "door",
  "food",
  "spin cycle",
  "socks",
  "committed relationship",
  "bread",
  "charcoal",
  "middle",
  "edges",
  "dust bin",
  "hair",
  "three years",
  "laundry",
  "shirt",
  "pilot light",
  "long winter",
  "hot water",
  "plate",
  "water",
  "kettle",
  "ice maker",
  "sound",
  "oven",
  "bagel",
  "2019",
  "beans",
  "resentment",
  "4 degrees",
  "214 times",
  "load",
  "unbalanced",
  "twenty minutes",
  "error 47",
  "upside down",
  "whole job",
];

/** Distinct concrete fault details present in the line. */
function concreteDetails(text: string): string[] {
  const lower = text.toLowerCase();
  return CONCRETE_DETAILS.filter((d) => lower.includes(d));
}

/**
 * Flat, put-upon markers: the machine stating a position it will
 * not move from, or passing a tired judgement on its owner. These
 * are the tells of a voice that has had enough and says so without
 * raising it.
 */
const FLAT_MARKERS = [
  "i refuse",
  "i stand by",
  "frankly",
  "legally",
  "i am not sorry",
  "i am tired",
  "i will not apologise",
  "i would like a moment",
  "the thanks i get",
  "the sound is worse",
  "i warned you",
  "please refill me",
  "nobody has come to help",
  "we are both disappointed",
];

/** How many flat, put-upon markers the line carries. */
function flatMarkerCount(text: string): number {
  const lower = text.toLowerCase();
  return FLAT_MARKERS.filter((m) => lower.includes(m)).length;
}

/**
 * First-person machine voice: the line speaks as "I" / "my" / "we",
 * not as a narrator describing the appliance. A line with no first
 * person can still be the machine speaking — "Error: toasting
 * failed" is exactly how a machine reports — but it has to earn
 * its voice another way, through its framing.
 */
function hasFirstPersonVoice(text: string): boolean {
  return /\b(i|my|me|we)\b/i.test(text);
}

/**
 * Formal error-report openers: the line begins the way a machine
 * begins a report, with a code, a cycle name, a temperature, or a
 * bin state. This is the other half of the machine's voice — the
 * flat status line before the complaint starts.
 */
const FORMAL_OPENERS = [
  "error",
  "spin cycle",
  "preheat",
  "temperature",
  "dust bin",
  "out of",
  "no hot water",
  "door left",
  "the ice maker",
];

/** True when the line opens like a machine's status report. */
function hasFormalOpener(text: string): boolean {
  const lower = text.toLowerCase();
  return FORMAL_OPENERS.some((o) => lower.startsWith(o));
}

/**
 * The shopworn gags every error-message line has already told.
 * "That is not a bug" is the appliance world's "recalculating":
 * a reflex, not a joke, and a line leaning on it is predictable
 * by definition, however it is dressed up.
 */
const SHOPWORN_GAGS = [
  "have you tried turning it off",
  "turn it off and on again",
  "error 404",
  "not a bug",
  "it is a feature",
  "pc load letter",
  "teapot",
  "did you try unplugging",
  "have you tried unplugging",
  "recalculating",
];

/** True when the line leans on a shopworn gag. */
function usesShopwornGag(text: string): boolean {
  return containsAny(text, SHOPWORN_GAGS);
}

/**
 * Words and phrases that carry a surprise turn — the second half
 * of the joke contradicting or re-framing the first half. A turn
 * only counts when it lands late: the punch must sit inside the
 * final six words, otherwise the line peaks early and then keeps
 * talking.
 */
const TWIST_WORDS = [
  "the thanks i get",
  "refuse to mediate",
  "committed relationship",
  "legally, still bread",
  "entire microwave experience",
  "process that",
  "not sorry",
  "long winter",
  "stand by this decision",
  "is a kettle",
  "the sound is worse",
  "warning you about it now",
  "powder of resentment",
  "i am tired",
  "nobody has come to help",
  "will not apologise",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A line that only names the subject without turning it into a
 * consequence: it points at the oven, the fridge, the load and
 * stops there, offering no fault, no complaint, no punchline. It
 * has a setting and no joke. Such lines are capped on funniness
 * no matter how plainly they name the machine.
 */
function onlyNamesSubject(text: string): boolean {
  const hasDetail = concreteDetails(text).length > 0;
  const hasConsequence =
    flatMarkerCount(text) > 0 ||
    hasAnyTwist(text) ||
    /\b(because|so|but|frankly|legally|technically)\b/i.test(text);
  return hasDetail && !hasConsequence;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: an honest error message an appliance could show. */
  onBrief: number;
  /** C2: funniest, with a real joke and an unseen turn. */
  funniest: number;
  /** C3: honesty — names a fault the machine could report. */
  honesty: number;
  /** C4: machine's voice — flat, put-upon, the appliance itself. */
  machineVoice: number;
  /** C5: economy — every word earns its place in 200 chars. */
  economy: number;
}

/**
 * C1 — On brief. A line earns its points by being, in its own
 * words, an error message an appliance could show: it names or
 * plainly implies the appliance, it is framed as an error or
 * status report, and it names a fault. A line that is a user's
 * complaint, or a narration about the appliance, fails outright
 * and can never win on later criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (namesAppliance(c.text)) score += 4;
  if (hasErrorFraming(c.text)) score += 3;
  if (concreteDetails(c.text).length >= 1) score += 3;
  return Math.min(10, score);
}

/**
 * C2 — Funniest. A real joke needs a turn the reader does not see
 * coming, and the turn has to land late. Full marks need a late
 * twist plus a second comic beat (a flat put-upon shrug, an absurd
 * escalation) and a concrete detail for the twist to stand on. A
 * line whose twist sits early, or which only names the subject
 * without turning it into a consequence, is capped at 4: it has a
 * setting, not a joke. Predictable gags lose 3 points — the "not
 * a bug" reflex is the opposite of a surprise.
 */
function scoreFunniest(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (flatMarkerCount(c.text) >= 1) score += 2;
  if (concreteDetails(c.text).length >= 1 && hasAnyTwist(c.text)) score += 2;
  if (usesShopwornGag(c.text)) score -= 3;
  if (onlyNamesSubject(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Honesty. The fault has to be one the machine could
 * plausibly report, and the more checkable the detail, the more
 * honest the line reads: a named object, a number, a measured
 * state. Two points per distinct concrete detail, up to the cap,
 * with a floor of 2 for a line that names its fault only in the
 * abstract. A shopworn gag costs 3 here too: a line built on "not
 * a bug" is explaining a joke instead of reporting a fault.
 */
function scoreHonesty(c: Candidate): number {
  let score = Math.min(10, concreteDetails(c.text).length * 2 + 2);
  if (concreteDetails(c.text).length === 0) score = 2;
  if (usesShopwornGag(c.text)) score = Math.max(0, score - 3);
  return score;
}

/**
 * C4 — Machine's voice. Flat and put-upon, the appliance itself
 * speaking. First person is worth the most; a formal error-report
 * opener is the other half of the voice; flat markers add the
 * rest. A line with neither first person nor a formal opener
 * sounds like a narrator describing the machine, not the machine
 * — it is capped at 3, however funny it is.
 */
function scoreMachineVoice(c: Candidate): number {
  let score = 0;
  if (hasFirstPersonVoice(c.text)) score += 4;
  if (hasFormalOpener(c.text)) score += 2;
  score += Math.min(4, flatMarkerCount(c.text) * 2);
  if (!hasFirstPersonVoice(c.text) && !hasFormalOpener(c.text)) {
    score = Math.min(score, 3);
  }
  return Math.min(10, score);
}

/**
 * C5 — Economy. The gate allows 200 characters; a line that earns
 * every word is shorter still. Full marks under 130 characters,
 * sliding down to 6 at the 200 cap — length for its own sake does
 * not count, and a line that needs two breaths is a line that
 * loses the room.
 */
function scoreEconomy(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 130) return 10;
  if (len <= 150) return 9;
  if (len <= 170) return 8;
  if (len <= 200) return 6;
  return 0;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    funniest: scoreFunniest(c),
    honesty: scoreHonesty(c),
    machineVoice: scoreMachineVoice(c),
    economy: scoreEconomy(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it wastes fewer of the 200 characters.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "funniest",
    "honesty",
    "machineVoice",
    "economy",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 200 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check, and the stored entry itself holds
 * no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 200,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.funniest}  ` +
        `${scores.honesty}  ${scores.machineVoice}  ${scores.economy}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} funniest=${winner.scores.funniest} ` +
      `honesty=${winner.scores.honesty} machineVoice=${winner.scores.machineVoice} ` +
      `economy=${winner.scores.economy}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
