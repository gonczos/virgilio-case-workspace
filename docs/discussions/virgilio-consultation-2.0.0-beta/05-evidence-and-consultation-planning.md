# Evidence availability and consultation needs

Date: 2026-09-12. Status: current planning slice, before detailed R3 conformance work.
No development, new collection or import is authorized. Investigation results and
consultation features have not yet been agreed or implemented.

## Why this comes next

The user identified two connected concerns: the scraper could expose richer data,
and that would affect the consultation layer. Defining required delivery contents
only around the existing export risks preserving its omissions and consolidation.
We will first connect available evidence to consultation needs, then use that result
to inform R3 delivery and acceptance rules. This changes planning order, not the
accepted semantic foundation or the open status of R3–R5.

Distinguish exposing evidence already retained from collecting new information.
The former may require an export change or supported reconstruction; the latter
requires separate collection planning and authorization. Do not assume either is
implemented or that all potentially useful features belong in the first increment.

## Work split

| Work | Owner | Deliverable |
| --- | --- | --- |
| Evidence inventory | Scraper | What is collected/retained, exposed, omitted, consolidated or inferred, with source-code references and limits |
| Consultation needs | Virgilio | Questions to support, proposed normal view and access to history/uncertainty/alternatives |
| First exchange scope | Joint | Required evidence, deferrable enhancements and unresolved gaps, respecting existing custody obligations |
| R3 conformance | Virgilio leads; scraper agrees profile | Delivery contents/unit, dependencies, acceptance and retry examples informed by the above |

The [scraper handoff prompt](prompts/01-scraper-evidence-inventory.md) is recorded
for use in the scraper chat. Saving it is not dispatch or completion of its task.
The scraper inventory has now been received at a895190b96c1a2313d7d67f09f3881d6b0a199e2.
See [consultation implications](06-consultation-implications.md) for provenance and proposed next decisions.

## Proposed consultation mapping — questions, not approved features

| Evidence distinction | Consultation question or consequence |
| --- | --- |
| Separate observations across captures | What was recorded when, and what differed between comparable observations? |
| Case-scoped acquisitions | Was this binary obtained through this case, or offered through inferred reuse? |
| Coverage/failures | Was an item not found, not checked, or affected by failure? |
| Multiple descriptions or binaries | What alternatives exist, and which observations support each? |
| Explicit corrections | What interpretation is currently selected and why; what preceded it? |
| Relationship origin | Was a connection source-reported, scraper-inferred or a Virgilio grouping decision? |

A consolidated normal view can remain simple while exposing its selection basis and
supporting history. Preserving every required observation does not require showing
all observations at once. Default-view rules, labels, history navigation and comparison
presentation remain proposals to assess in Virgilio, not scraper design decisions.
No latest-arrival-wins or automatic strongest-truth rule is adopted here.

## Expected scraper inventory

For cases, buckets, listings/multiplicity/membership, source identifiers/retrieval
context, source artifacts, attempts/binaries/failures/retries, scope/coverage/times,
historical interpretations/corrections, relationships and assessments, distinguish:

1. What Citius provides and the scraper actually collects and retains.
2. What the portable exchange exposes faithfully today.
3. What is omitted, consolidated, inferred or loses context.
4. What can be exposed from retained evidence or reconstructed with supported lineage.
5. What requires additional collection or cannot currently be established.

Each category needs meaning, implementation references, identity/scope/quality limits,
a possible consultation use, and the type of work required to expose it. Verify facts;
do not assume that code behavior proves a particular historical loss or completeness.

## First-scope decisions to make after inventory

Classify candidates as necessary for faithful consultation, useful but deferrable,
or requiring investigation/collection. Required preservation material under the
accepted R2 baseline cannot be made optional merely to shrink UI or implementation
scope. Display priority and preservation requirements are different decisions.

Virgilio then considers the normal consultation view and how history, partial
assessment, unresolved matching, conflicting observations and inferred reuse remain
available. Jointly select a bounded exchange scope, then detail R3. R4 coverage/matching
and R5 revision-resolution remain owned open work, not implicitly resolved by inventory.

## Status and next checkpoint

- Planning scope and scraper prompt: recorded here.
- Scraper inventory: received; pinned report read, underlying artifact checks not repeated here.
- Virgilio consultation assessment: [initial proposals recorded](06-consultation-implications.md); user scope/default-view decisions pending.
- First exchange scope and detailed R3 rules: pending.

Next: discuss the candidate first scope and normal consultation view using the received inventory. Preserve results and new decisions
under this planning directory without treating them as accepted architecture.

## Consultation direction now specified

The user has requested [connected consultation views and ingestion management](07-consultation-and-ingestion-management.md).
Use case/document/binary navigation and a delivery-question-decision journey to map
required evidence before fixing R3. Detailed actions, R4/R5 rules and implementation
remain open. This is an additional product-planning requirement, not runtime authority.
