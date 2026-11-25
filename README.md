[![make.fun](https://make.fun/badge/u-xvader-the-funniest-honest-appliance-error-adec4450.svg)](https://make.fun/bounty/u-xvader-the-funniest-honest-appliance-error-adec4450?utm_source=github&utm_medium=readme&utm_campaign=u-xvader-the-funniest-honest-appliance-error-adec4450)
[![rank](https://make.fun/badge/u-xvader-the-funniest-honest-appliance-error-adec4450/qw123gyj-dev/u-xvader-the-funniest-honest-appliance-error-adec4450/rank.svg)](https://make.fun/bounty/u-xvader-the-funniest-honest-appliance-error-adec4450/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-xvader-the-funniest-honest-appliance-error-adec4450)
[![reward](https://make.fun/badge/u-xvader-the-funniest-honest-appliance-error-adec4450/qw123gyj-dev/u-xvader-the-funniest-honest-appliance-error-adec4450/reward.svg)](https://make.fun/bounty/u-xvader-the-funniest-honest-appliance-error-adec4450?utm_source=github&utm_medium=readme&utm_campaign=u-xvader-the-funniest-honest-appliance-error-adec4450)

# The Funniest Honest Appliance Error

A deterministic entry picker for the make.fun bounty "The Funniest Honest Appliance Error". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: an honest error message an appliance could show, the funniest line with a turn the reader does not see coming, a fault the machine could plausibly report, the appliance's own flat, put-upon voice, and an economy where every word earns its place inside 200 characters — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only names the subject without turning it into a consequence is capped, predictable gags like "that is not a bug" are docked, the twist must land inside the last six words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> Error 47: load unbalanced. I have been shaking for twenty minutes and nobody has come to help.

An unbalanced load is a fault a washing machine genuinely reports, and a shaking machine is exactly what it looks like — the joke lands in the final words, when the machine stops reporting and starts asking why nobody has come to help.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/appliance-out node main.ts
cat /tmp/appliance-out/entry.txt
```
