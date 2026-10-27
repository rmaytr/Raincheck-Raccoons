# Technical case study

## Objective and process

Deliver a reusable no-login multiplayer game whose rules, feedback and visual identity work on phones and laptops. The creator established product requirements and creative direction and guided iteration. OpenAI Codex and specialist agents supported research, implementation, asset production, independent review and validation. This describes an AI-assisted engineering project rather than claiming all implementation was manual.

Two research workstreams generated 100 concepts; twelve finalists were compared for feasibility, originality, experiential value and polish. Independent research retained twelve official sources. Simultaneous roof/role selection was chosen to give all players agency without long individual turns, required drawing, or a separate display.

## Problems solved

**Concurrent actions:** D1 revision-checked writes reload and retry on contention. Independent API clients exercised nine parallel joins and ten parallel choices without duplicated round scoring.

**Private decisions:** room responses are constructed from an allowlist. Opponent plans and session hashes stay on the server. Cookies establish session membership separately from invitation codes.

**Old actions crossing rematches:** round numbers alone were insufficient. A changing match identifier now accompanies each choice and rejects prior-match requests, including delayed round-one actions.

**Late responses after leaving:** a client lifecycle generation invalidates in-flight responses. A regression test releases a held response after Leave and checks that the room does not reappear.

**Transient startup failure:** saved-room recovery preserves identity on network/503 errors and offers Retry. Authoritative missing/unauthorized responses clear unusable state. Draft selections survive ordinary polling updates.

**Quota record abuse:** review found that quota allocation preceded authentication. Membership now precedes allocation and is checked again inside mutation. Forged-cookie regression requests returned 403 without increasing quota-row count.

**Useful cooperative role:** baseline balance simulation showed weak rewards for a half-share Lookout. A full-share revision was compared in 5,280 composition cases. Lookout can protect a crew but earns nothing without a collector, retaining a volunteer dilemma. Simulation policies were deliberately simple and do not establish human enjoyment or optimal strategy.

**Visual and touch behavior:** original SVG scenes required preserving positional transforms during animation; mobile planning needed reachable fixed submission controls. Review also corrected icon-only help labeling, modal focus behavior and effective weather/cover previews.

## Delivered scope

The product supports 2–10 players, six raids, four roofs, three roles, eight raincoats and a same-engine practice mode with three labeled bots. A four-phase engine, typed action contracts, four API operations and two-table persistent model connect the client to hosted Workers/D1.

Verification includes 27 engine tests, 49 API checks, 3 actual-deadline lifecycle checks and 31 browser checks. The release was validated on the public site through a complete anonymous two-browser match and rematch. Source, archive and deployment identity were recorded for release traceability.

## Next validation priorities

1. Observe novice groups and voluntary replay at four to ten people across physical devices/networks.
2. Expand browser/assistive-technology coverage and explore relaxed timing.
3. Profile performance under a defined load before selecting transport or storage changes.
4. Add authored roof/weather content after feedback on the existing interaction.

There are no measured adoption, retention or large-scale production outcomes yet. [Testing scope](testing.md) explains what the evidence establishes.

[Back to README](../README.md)
