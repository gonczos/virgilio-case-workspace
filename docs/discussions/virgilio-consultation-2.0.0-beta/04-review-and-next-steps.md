# Joint review and next steps

Status: review preparation only, 2026-09-12. No independent review performed.

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
