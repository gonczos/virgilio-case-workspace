# Labelled-reference-v5 ingestion response review

This review covers the saved consultation responses produced for the bounded fixture-scoped v5 ingestion checkpoint. The user explicitly authorized correction of response-review findings. That authorization supersedes the earlier API-contract exclusion only for accurate coverage status/message text and for exposing already-stored normalization and extraction provenance. It does not authorize wider lookup scope, new retrieval semantics, UI work, corpus processing, target resolution, or graph relationships.

## Reviewed cases

Six durable response cases are restricted to observations carrying both `reference-text-observation-identity-v1` and fixture scope `frozen-v5-expansion-and-foundation`:

- direct Portuguese attachment;
- physical folio with associated procedural contexts;
- explicit colon-form register;
- explicit numbered register;
- damaged French inherited pièce label; and
- coordinated procedural reference.

One additional case is labelled `transactionally_constructed_and_rolled_back_validation`. It uses a real canonical procedural source span, creates a temporary older extractor observation and attributable review, runs the actual ingester, and reads the actual consultation lookup/serializer. The response contains the current canonical observation and retained reviewed superseded history with the replacement link. The transaction then rolls back, leaving no persisted sample observation row, review row, or lifecycle-event row. PostgreSQL observation and lifecycle-event sequences still advance because sequence allocation is nontransactional. This validation is state-affecting and must not be presented as a side-effect-free routine; sequence values are not restored.

## Checks

- Every durable observation has the canonical identity version and exact frozen fixture scope.
- Representation, segment, observation span, label span, rule, extractor version, and both content hashes are exposed.
- Document-text normalization identity is populated from observation metadata when the dedicated metadata-ingestion column is null.
- Targets remain unresolved and target-candidate arrays remain empty.
- Associated binaries and all sourced procedural contexts remain visible.
- Lifecycle state, replacement identity, review attribution, and unresolved review decision are preserved in the rolled-back case.
- Full-scope coverage says that court metadata is corpus-wide, external-register observations remain pilot-scoped, and document-text observations cover the legacy pilot plus the frozen v5 expansion and foundation fixtures only.
- Missing-file behavior is not applicable to these document-text samples and was not fabricated; it remains covered by the established recorded-reference API tests.

## Findings and corrections

Independent review found stale pilot-only wording, a missing document-text normalization fallback, insufficient canonical sample filtering, and an incomplete saved current/history response gate. The implementation corrects those issues as narrowly described above. A later review also corrected the phrase “zero database residue”: only the temporary rows, review, and lifecycle event are absent after rollback; sequence advancement remains durable.

Independent review status: complete with no remaining findings. The final
review independently confirmed the six durable samples, the rolled-back
lifecycle sample, coverage and normalization provenance, the absence of
temporary rows, and the explicitly disclosed sequence advancement.
