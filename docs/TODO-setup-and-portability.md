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

## Current Versus Target Deployment Direction

Current verified development/runtime behavior remains the hybrid
host-plus-Docker setup documented in `docs/SETUP.md`.

That means today:

* Docker Compose runs PostgreSQL, Directus, and the binary gateway;
* local host Node.js runs the importer, consultation API, and UI dev
  server;
* local host Python and CLI tools run processing.

This document does not redefine that as already portable.

The preferred portability direction to evaluate is a Docker-first
deployment target in which the host provides primarily:

* Docker Desktop or Docker Engine with Compose;
* sufficient CPU, RAM, and disk;
* persistent storage directories or volumes;
* a small documented environment/configuration surface.

Developer mode may still remain hybrid where convenient even if a
Docker-first deployment target becomes the preferred portability path.

## Deployment Strategies To Compare

### A. Host-Managed Installation

The host installs and manages:

* Node.js;
* Python;
* Docling;
* Xberg;
* `pdftotext`;
* `pdfinfo`;
* `qpdf`;
* OCR/model dependencies;
* model caches;
* runtime environment/configuration.

This is close to the current processing/developer setup shape.

### B. Docker-First Portable Deployment

Conceptual target to evaluate:

```text
docker compose
├─ postgres
├─ directus
├─ binary gateway
├─ consultation API
├─ UI
├─ importer/runtime tooling as appropriate
└─ processing worker
   ├─ pdftotext
   ├─ pdfinfo
   ├─ qpdf
   ├─ Xberg
   ├─ Python
   ├─ Docling
   └─ OCR dependencies
```

This is a deployment-direction sketch only.

It does not imply:

* one container per processor;
* a processor-specific container architecture;
* Redis, RabbitMQ, or external queues;
* Kubernetes or distributed worker orchestration.

The existing processing registry and job architecture should remain
responsible for processor selection and execution policy unless a later
task deliberately changes that design.

## Docker-First Constraints

Dockerization is deployment infrastructure. It must not leak into the
canonical evidence or provenance model.

Canonical or provenance semantics must not depend on:

* Docker container IDs;
* Docker service names;
* container-specific absolute paths;
* machine-specific mount paths.

Application/runtime code should continue to rely on storage and
processing abstractions such as:

* `BinaryStore`;
* logical storage locators;
* immutable representation identities;
* persisted processing jobs.

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
* when or whether artifact storage should receive its own abstraction;
* how a Docker-first deployment would mount and preserve:
  * PostgreSQL data
  * canonical imported binaries
  * derived processing artifacts
  * processor/model caches where persistence is required

The design must preserve restart and redeployment safety.

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

This distinction must remain possible under any Docker-first deployment
shape, including the current separation between:

* cheap evidence extraction;
* moderate interpretation;
* heavy Docling/OCR work.

### 11. Setup Documentation Verification

Still needed:

* validate `docs/SETUP.md` end-to-end on another clean Windows machine;
* record which instructions are verified by real installation rather than
  only repository inspection and current local usage;
* refine the boundary between stable instructions and unresolved
  portability work.

### 12. Docker-First Portability Acceptance Target

Future acceptance target to evaluate:

```text
clean supported Windows machine
  -> install Docker Desktop
  -> obtain Virgilio
  -> configure documented host-level settings
  -> create/mount persistent storage
  -> docker compose up
  -> bootstrap an empty instance
  -> open the UI
  -> ingest a real PDF
  -> run baseline cheap evidence processors
  -> run Xberg/Docling/OCR
  -> inspect original and derived content
  -> restart the stack
  -> verify database, binaries and derived artifacts remain coherent
```

This is a future portability criterion, not a claim that the repository
already supports that workflow today.

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
