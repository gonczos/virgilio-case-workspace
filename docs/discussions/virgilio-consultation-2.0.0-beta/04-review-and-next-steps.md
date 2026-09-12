# Joint review and next steps

Status: independent joint review completed 2026-09-12; findings open, contracts unaccepted.

## Review scenarios

| Scenario | Required distinction |
| --- | --- |
| Identical fresh collection | New observation/event, possibly shared stored bytes |
| Replay of the same evidence | No invented collection or acquisition |
| Metadata changes | Justified match, both observations retained |
| Bucket gains unchanged document | Altered membership, separately assessed document metadata |
| Item missing from complete listing | Absence qualified to assessed scope, not court deletion |
| Partial/failed listing | Not assessed where coverage is insufficient |
| A returns Y instead of X, B unobserved | A-scoped acquisition change; no observed change propagated to B |
| One representative retrieval | Actual attempt distinguished from inferred reuse elsewhere |
| Parser correction | New interpretation, not new source observation |
| Coverage correction | Original declaration plus attributed revised assessment |
| Omitted historical artifact | Supported supplement or unresolved attribution; discovery time is separate |
| Adapter succeeds but broker rejects | No accepted evidence; final acceptance belongs to broker |
| Mapping rules corrected | Exact upstream lineage, attributed mapping revision; no invented scraper correction/source event |
| Incomplete delivery then retry | No partial accepted evidence or duplicated source events |
| Same bytes repackaged or relocated | Operational change alone is not immutable evidence conflict |
| Conflicting revisions | Explicit attributed resolution; no arrival-order winner |
| Evidence arrives before comparisons | Availability explicit; later results reference exact revisions |
| Practical case grouping | No invented court relationship |
| Legacy package | Unknown chronology/coverage remains unknown |
| Event-based provider or future Citius API | No invented scrape semantics or acquisition; core VIEC unchanged where meanings fit |

## Joint review questions

1. Do identities distinguish source tokens, description variants, occurrences,
   collection events, attempts, content and delivery units without overclaiming?
2. Does coverage support each absence and each unchanged claim? Can resumed attempts
   falsely suggest simultaneous state or completeness?
3. Are required dependencies and the acceptance unit sufficiently precise?
4. Can all earlier accepted states and derivations remain traceable through corrections,
   supplements, conflicts and late arrivals?
5. Does the Citius profile faithfully map to VIEC without making Citius concepts universal?
6. What belongs to the Evidence Broker, provider adapter and upstream collector?
7. Which reported implementation gaps are verified, and what historical reconstruction
   is actually supported by retained artifacts? Do not presume irreversible loss.
8. What version compatibility obligations apply to independently released modules?

## Sequence

- Complete the provider-independent VIEC and Citius profile split jointly with scraper.
- Identify a concrete Git checkpoint for coordinated independent review of both sides.
- Reviewer returns contradictions, missing obligations and decisions; no implementation.
- Resolve findings and record explicit contract acceptance before promoting architecture.
- Plan one bounded implementation slice with validation and migration decisions.
- Begin development only when separately authorized.

Do not run imports, scrapes, migrations, expensive processing or deployment as part
of planning. No runtime prerequisite or startup procedure changed in this checkpoint.
The local API idea is a candidate delivery mechanism, not an agreed implementation.

## Coordinated review inputs and alignment outcome

The user supplied the scraper alignment response against Virgilio checkpoint
`a175724e7e8fdbf08718837d08ab38071c701c4f`. It reported no substantive contradiction
and requested explicit acceptance authority, mapping provenance and version-label
clarification. Those clarifications are incorporated in Virgilio planning revision 2.
This is alignment work, not independent review or contract acceptance.

Pinned scraper input: `8f6b1b7e42406387d38040e6b652def5ae706153`, tag
`scraper-0.2.6-baseline`, in `C:/repos/scraper/repository`:

- `docs/20-roadmap/phase-04-evidence-contracts/citius-scraper-contract-proposal.md` — revision 3.
- `docs/20-roadmap/phase-04-evidence-contracts/decisions-and-review.md` — revision 3.
- `docs/20-roadmap/phase-04-evidence-contracts/implementation-grounding.md`.

The tag-to-commit resolution, both revision headers and grounding-file existence
were checked locally read-only. This does not independently verify every reported
implementation finding. The scraper's preserved exchange draft is historical input;
Virgilio's current checkpoint supplies the broker/VIEC split and mapping clarification.

Use the Git commit containing this revision-2 brief as the updated Virgilio review
input, rather than silently treating the earlier a175724 checkpoint as amended.
Record that resolved full commit hash in the independent-review prompt. The upstream
contract version remains unassigned; the pinned revision/commit provides exact identity.
The scraper application tag is not a contract version or a 0.3.0 release commitment.

Matching, completion criteria, acceptance granularity, supplement attribution,
revision resolution and comparison details remain open review questions. No
additional implementation decisions are required merely to select these inputs.

## Independent review result

The [review request](review/01-request.md) pins both inputs explicitly.
The [findings](review/02-findings.md) report no substantive cross-project contradiction,
with R1–R2 recommended for resolution before contract acceptance and R3–R5 retained
as implementation-readiness decisions. The review did not alter the contracts or
approve development. Next: discuss R1–R2 jointly and return proposed clauses for a
bounded follow-up review; keep owner-assigned R3–R5 visible in implementation planning.

## Follow-up preparation after joint wording agreement

R1/R2 clauses are incorporated on the Virgilio side in planning revision 3. See the
[resolution tracker](review/03-resolution-tracker.md). The prior pinned inputs and
review findings remain historical. The follow-up must use this incorporation's Git
commit plus the scraper's amended checkpoint, which has not yet been supplied.
The same reviewer will assess R1/R2 only, including consistency with prior obligations;
R3–R5 remain visible and neither contract is accepted by this drafting step.

## Focused follow-up completed

The [follow-up result](review/06-follow-up-result.md) verifies R1/R2 resolved in
Virgilio a1051bc94a6180652483e1e7f5fd62ba875b8690 and scraper
8a046a37fabe1cace268ed40e0ad4be944f94f57. This supersedes the pending-review status
above without changing those historical inputs. R3–R5 remain open; neither contract
is accepted or implementation-authorized. Next: decide contract acceptance explicitly
and plan the owned R3–R5 conformance, coverage/matching and revision-resolution work.

## Accepted semantic planning baseline

The user accepted the reviewed foundation for planning only. Its bounded scope is
[recorded in architecture](../../architecture/24-virgilio-2-semantic-planning-baseline.md).
The previous pending-acceptance entries are historical. Complete-contract acceptance
and development remain outside this decision. Continue with R3 delivery/acceptance
planning, coordinate scraper-owned R4, and keep joint R5 visible. No runtime actions.
