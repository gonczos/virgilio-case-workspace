# Intermediate scraper development: original case/act response preservation

Recorded 2026-09-12. Status: scraper implementation/offline validation complete; live validation pending sign-in.
Virgilio changes remain documentation only. No delivery/import acceptance or full-contract
acceptance follows from this slice. R1/R2 and accepted semantic foundation are unchanged.

## Why this precedes delivery design

The user asked whether responses should be recorded first to understand their contents.
We agreed to correct the sequence: inspect retained samples, implement the agreed
preservation scope, validate a bounded collection, then use actual retained evidence to
select structured fields and delivery requirements. The user then explicitly requested:
"pls coordinate this intermediate development with the scraper".

Earlier planning-only statements are superseded for this specific scraper slice, not
for Virgilio broker/adapter/importer work. Three high-level directions remain agreed in
[the scope record](11-revised-collection-scope.md). Detailed R3–R5 remain open.

## Request dispatched to scraper

Task: Define data contract boundaries, 01a095c2-def6-7cb2-a7fb-6015cde04d52.
Virgilio input checkpoint: 79db7fc5fa95f71316ac051ad63a764566b6afa3.
Use existing committed scraper live samples, participant extension and decision records.

1. Inspect existing original case/act samples and collector/recovery code; record the
   concrete scope before implementation.
2. Preserve original case-list and act-list response bodies (including actual pagination)
   obtained during declared collection, with exact supported body form, hashes, observation
   times, actual request/case/page/attempt context and wider returned membership/scope.
   Carry references through full JSON, recovery and checkpoint structures.
3. Preserve distinctions among absent/error/malformed/empty outcomes where relevant,
   committed observations on resume, and raw source wrappers/values without automatic
   semantic promotion. Keep participant preservation and acquisition evidence intact.
4. Avoid extra requests solely for capture and unrelated traffic/credentials. Do not
   implement binary refresh, new endpoints, executive scope, DB ingestion or export changes.
   Use the scraper's separate development image practice; no release/version promotion/push.
5. Run focused offline tests for context association, broader scope, pagination, outcomes,
   exact bodies/hashes and recovery, plus existing relevant regressions.
6. If supported authentication is available, validate on main case 13608/14.8T2SNT:
   case-list response, initial act-list page and at most one further real pagination
   response. No binary downloads or six-case expansion. Record wider normal response scope.
   If login is unavailable, finish offline work and report the exact user step needed.
   Respect the user's visible-browser preference for interactive inspection.
7. Return code/docs checkpoints, tests and actual source structures retained, limits and
   unresolved issues. Keep originals/personal values outside Git and reports structural.

This is a bounded interpretation of the authorized development request, not authorization
to perform all candidate collection enhancements. No source artifacts or responses are
copied into Virgilio or deemed accepted evidence by this planning record.

## Virgilio review criteria

The implementation must not turn body preservation into an unsupported full wire/session
capture guarantee. Returned response scope may exceed the selected case/act; capture and
interpretation scope remain separate. Each capture needs event context distinct from its
content hash; equal bodies on different requests do not collapse events. A parse failure
must not silently masquerade as an empty source result. Recovery must retain original
committed evidence and identify missing/tampered required response artifacts.

Review what is actually retained, not just new field names: raw dates, nil/zero/absent
values, source-versus-display distinctions and nested document membership are principal
consumer questions. Uncertain source identifiers/digests remain raw assertions. Capturing
responses should not imply that every field is interpreted, exposed or semantically settled.

Next after implementation/validation: inspect the retained response evidence and update
the collection inventory, then plan R3 deliveries with R4/R5. No automatic transition to
Virgilio implementation, import, full scrape or repeated acquisition is authorized.

## Interim implementation review and authentication limit

Read the in-progress capture module and collector/recovery diff for scope alignment.
The proposed capture boundary is same-origin POST case/act endpoints during navigation
and pagination. It labels Playwright-provided bodies explicitly, separates intended
selection from returned membership, journals captures and adds referenced bodies to
recovery integrity checks. This is a targeted code/scope inspection, not a complete
independent review or a rerun of scraper tests.

The scraper reported the live attempt reached login with no case/act API response
observed; supported authentication is no longer usable. It left the browser visible
and is completing offline verification. No fresh response findings should be inferred
from this attempt. Existing retained samples remain the source-structure basis until
bounded live validation can run after sign-in. The user's existing bounded authorization
continues to apply; no wider collection or repeated permission request is needed.

## Committed implementation received

Scraper checkpoint: 537bdfa34626e9755cda50bab8a1cb2df5de9cde.
Report: C:/repos/scraper/repository/docs/20-roadmap/phase-04-evidence-contracts/listing-response-preservation.md.
Read the report and relevant in-progress collector/module/recovery integration; the
reviewed report matches the committed version. No independent full implementation review
or local rerun of scraper tests is claimed.

Implemented: same-origin POST case/act response capture in ordinary navigation/pagination;
event/attempt identity, intended selection and allowlisted transmitted context/page;
response times/status, original supported body form, hashes/path and structural outcomes.
References survive full JSON, responses.jsonl journal, case checkpoint references and
recovery. Equal bodies from different requests retain distinct event identity. Whole
originals retain broader membership, raw wrappers and nested fields. New semantic fields
are not promoted by preservation alone.

The capture boundary excludes headers/credentials/unrelated routes and introduces no
extra fetch solely to capture a body. Action-window and in-flight limits are explicit:
late responses or abrupt termination can remain uncommitted; recovery guarantees concern
committed checkpoints. Parse/body/HTTP/source/storage failures and missing/empty outcomes
are separate. Stored subrecords or formatted inspection copies are not substituted for
original bodies. No full wire/session or completed court-coverage guarantee is made.

Scraper reports 35 offline tests passed in the final network-disabled development image,
including real browser pagination events and the full two-case synthetic collector,
exact bytes/hashes, scope/mismatch, failure/storage outcomes and recovery integrity.
Development image: virgilio-scraper:listing-responses-dev,
sha256:8e58d8281b2177ce2de225255b5be246a07095d9dc0a7b7d7ccc6186c0312056.
Its label records prior base plus dirty development source, not a false clean-commit build.
Frozen/default image, module versions, participant/binary behavior, DB and export unchanged.
Scraper reports clean tree, no push and successful syntax/link/diff checks.

## Validation remaining and next consumer work

Bounded live validation remains blocked by authentication. The stopped attempt finished
2026-09-12T19:56:48.250Z at login, with no case/act API response observed. Its private
record remains under C:/repos/scraper/output/listing-response-validation-20260912/;
the helper was a pre-final local copy and does not validate the final build. Browser
remains visible. User sign-in is required, then resume a fresh recorded final-module
check within the already authorized main-case/initial-page/at-most-one-additional-page
scope. Preserve the stopped attempt. No new binary retrieval is part of that check.

Earlier sample responses remain available: six returned cases and fifteen acts on the
captured page, not full history. The scraper opened originals and separate formatted
inspection copies at the user's request. Their structures can already inform discussion,
but must not be presented as newly captured by this implementation.

This intermediate implementation and offline validation are complete; live validation
is pending. After sign-in and bounded validation, inspect actual retained bodies before
fixing R3 delivery dependencies. R4/R5 and full contracts remain open; no Virgilio runtime,
import or delivery acceptance occurred. No material scope contradiction found in this
coordination review; live readiness is deliberately not claimed.
