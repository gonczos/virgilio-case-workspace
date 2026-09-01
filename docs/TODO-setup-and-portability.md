# TODO Setup And Portability

Last updated: 2026-09-01

## Authority

This document tracks unresolved setup, portability, installation, and
operational-readiness work.

It is not the operational setup source of truth.

Use `docs/SETUP.md` for instructions that are currently intended to work
today.

## Purpose

Track what still needs to be defined or implemented so Virgilio can move
from the current repository-grounded local setup to a more reproducible
installation and portability story.

## Future Goal Areas

### 1. Clean Windows Setup

Desired outcome:

```text
clean Windows machine
  -> obtain repository
  -> install prerequisites
  -> configure environment
  -> bootstrap database
  -> start services
  -> import corpus
  -> run processing
  -> open UI
```

This has not yet been validated as a fully documented clean-machine
workflow.

### 2. Setup Automation

Potential future entry point:

```powershell
.\scripts\setup.ps1
```

Possible responsibilities:

* check core prerequisites;
* install repository dependencies where appropriate;
* prepare `.env`;
* prepare storage roots;
* bootstrap the database;
* prepare UI dependencies;
* validate processor dependencies.

Not implemented yet.

### 3. Environment Doctor

Potential future entry point:

```powershell
.\scripts\doctor.ps1
```

Desired behavior:

* distinguish installed/configured/executable/usable;
* report service reachability;
* report database/bootstrap status;
* report processor capability availability.

Not implemented yet.

### 4. Processor Capability Detection

Desired future capability:

```text
pdf_literal_text        available/unavailable
pdf_signature_metadata  available/unavailable
pdf_structure_inventory available/unavailable
xberg                   available/unavailable
docling                 available/unavailable
pdf_ocr_text            available/unavailable
```

Prefer checks that can distinguish:

* installed
* configured
* executable
* version known
* usable

Not implemented yet.

### 5. Windows Processor Prerequisite Installation

Still unresolved:

* canonical installation instructions for `pdftotext`
* canonical installation instructions for `pdfinfo`
* canonical installation instructions for `qpdf`
* reproducible Python/tool bootstrap for Docling and Xberg
* reproducible offline model-cache preparation for Docling/OCR

The repository currently depends on those capabilities but does not yet
provide one supported installation path.

### 6. Existing-Database Migration Procedure

Still unresolved:

* one canonical way to apply repository migrations to an already
  initialized database;
* migration ordering and operator workflow for non-empty environments;
* how to verify that an existing database matches the current bootstrap
  schema plus migrations.

### 7. Existing-Instance Migration

Still unresolved:

How to move an already populated Virgilio instance to another machine
while preserving coherence between:

* PostgreSQL state
* imported packages under `data/imports/`
* original binary resolution
* derived artifacts under `data/exports/processing/`
* processing runtime caches where needed

Copying PDFs alone is not sufficient for an existing instance.

### 8. Empty-Instance Bootstrap Validation

Still needed:

* explicit clean-machine or empty-instance validation of the documented
  setup path;
* explicit validation of first-run Directus, gateway, consultation API,
  UI, import, and optional processing setup.

### 9. Storage Portability

Still unresolved:

* how current `data/imports/`-anchored original-binary storage should be
  migrated across machines;
* how to package or relocate canonical binaries safely;
* whether later setup should support configurable storage roots;
* when or whether artifact storage should receive its own abstraction.

This phase does not change the current `storage_package_id` +
`storage_rel_path` model.

### 10. Simplified Startup

Potential future goal:

```powershell
npm run start:local
```

or another equivalent operator-friendly startup path.

Important constraint:

normal application startup should remain distinct from expensive corpus
processing. Starting Virgilio should not implicitly start a large Docling
or OCR backlog.

### 11. Setup Documentation Verification

Still needed:

* validate `docs/SETUP.md` end-to-end on another clean Windows machine;
* record which instructions are verified by real installation rather than
  only repository inspection and current local usage;
* refine the boundary between stable instructions and unresolved
  portability work.

## Standing Documentation Policy

`docs/SETUP.md` is reserved for instructions that are currently intended
to work and are repository-backed.

This file is the place for:

* unresolved portability work;
* planned setup automation;
* readiness/doctor features;
* migration/export ideas;
* installation gaps that should not be presented as current supported
  instructions.
