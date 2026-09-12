# Scraper handoff — evidence availability and consultation needs

Prepared 2026-09-12. Planning prompt, not an executed or completed investigation.
The following is the handoff text supplied in the conversation, saved for reuse.

---

We are continuing planning for Virgilio Consultation 2.0.0 beta. Before detailing R3 delivery and acceptance rules, we need to assess two connected concerns:

1. The scraper may retain or be able to collect richer evidence than it currently exports.
2. That evidence affects what Virgilio can faithfully offer in consultation.

Please perform a bounded, read-only investigation of evidence availability on the scraper side. Follow the standing documentation workflow: record meaningful findings in the appropriate planning documents, review and commit documentation changes only.

Do not change implementation, collection behavior, databases, exports or versions. Do not run scrapes/imports or assume additional collection is authorized.

Use the accepted semantic foundation:

- Preserve observations, acquisitions and their scope separately.
- Differences add evidence; corrections retain lineage.
- Shared identities or bytes do not establish an acquisition in an unobserved case.
- Unknown coverage and provenance remain unknown.
- R1/R2 are verified resolved; R3–R5 remain open.
- VIEC is provider-independent; Citius-specific meanings belong to this integration.
- Complete contracts and development are not yet approved.

Please inventory:

A. What the scraper currently collects and retains.
B. What the existing portable export exposes faithfully.
C. What is omitted, consolidated, inferred or loses context during export.
D. What additional information would require new collection.
E. What cannot be established from available evidence.

Cover, where applicable:

- Case and bucket metadata.
- Document listings, multiplicity and membership.
- Source identifiers and retrieval context.
- Original captures and response artifacts.
- Acquisition attempts, binaries, failures and retries.
- Collection scope, coverage and observation times.
- Historical differences, interpretations and corrections.
- Source-reported relationships versus inferred associations.
- Binary validation and readability assessments, including their provenance.

For each meaningful category, provide:

- Its meaning and current location, supported by implementation references.
- Current preservation and export behavior.
- Known identity, scope and reliability limitations.
- Whether exposing it needs an export change, reconstruction from retained evidence, or new collection.
- Which consultation question it could support.

Example consultation questions:

- What did the court list in this case at this collection?
- Which binary did we actually obtain through this case?
- Was this item absent, outside scope, or affected by collection failure?
- What changed between comparable observations?
- Is this relationship observed or inferred?
- Why are there multiple descriptions or binaries?
- Was a difference caused by the source or by a corrected interpretation?

Describe these as possible supported questions, not approved UI features. Virgilio owns consultation design, default-view selection and presentation.

Recommend a small first evidence-exposure scope:

- Necessary for faithful consultation.
- Useful but deferrable.
- Requiring additional investigation or collection.

Do not classify evidence already required by the accepted preservation obligations as optional merely to reduce scope. Distinguish preservation requirements from what is displayed by default.

Separate verified implementation facts, supported reconstruction possibilities and proposed enhancements. Do not assume historical losses or completeness without evidence.

Return:

1. The evidence inventory and consultation-question mapping.
2. The recommended first scope and its limitations.
3. Questions Virgilio must answer before R3 can define required delivery contents.
4. Documentation paths, validation and commit hash.

This investigation should inform R3, not resolve delivery schemas, API endpoints, database migrations or the full consultation design.
