Create a narrow repository documentation checkpoint for Virgilio setup, portability, and installation readiness.

Do not implement the setup automation yet.

Do not install or change dependencies.

Do not modify processing behavior.

Do not start another processing rollout.

Do not change database schema.

Do not start Phase D.

The purpose of this task is to capture what we already know about making Virgilio reproducibly usable on another Windows machine, and establish a repository policy that setup documentation must remain current as the system evolves.

# Objective

Create a durable TODO/readiness document describing the path toward:

```text
clean Windows machine
        ↓
obtain Virgilio
        ↓
setup
        ↓
verify environment
        ↓
start
        ↓
open consultation UI
        ↓
ingest/process documents
```

The document must distinguish:

```text
known requirement
```

from:

```text
implementation decision still to be made
```

Do not invent deployment architecture merely to fill gaps.

# Current known deployment shape

Document the currently known local-first architecture.

Conceptually:

```text
Virgilio installation
│
├── application/repository
│
├── Node.js runtime
│
├── PostgreSQL
│
├── Directus
│
├── consultation API
│
├── original-binary gateway
│
├── consultation UI
│
├── processing worker/tooling
│
├── canonical binary storage
│
└── derived artifact storage
│
└── local processor capabilities
    ├── pdftotext
    ├── qpdf / PDF evidence tooling
    ├── Xberg
    ├── Docling
    └── OCR toolchain
```

Verify this against the current repository before documenting exact commands or dependencies.

Do not treat this conceptual list as authoritative where the repository says otherwise.

# Important current constraint

The current application path is local Windows.

In particular:

```text
pdf_literal_text
    -> local Windows pdftotext CLI
    -> invoked directly from Node
    -> reads local PDF
    -> produces local artifact
    -> no remote service
    -> no WSL dependency
```

Preserve this fact in the setup/readiness documentation.

Do not replace it with WSL, a remote extraction service, or another architecture.

# Deployment scenarios

Document at least two distinct scenarios.

## 1. Fresh installation

Conceptually:

```text
Virgilio software
+
fresh PostgreSQL/database
+
empty canonical storage
+
empty derived-artifact storage
        ↓
ready to ingest a new corpus
```

Identify the currently known requirements for making this reproducible.

## 2. Existing-instance migration

Conceptually:

```text
Virgilio software
+
PostgreSQL state
+
canonical binaries
+
derived artifacts
        ↓
same corpus on another machine
```

Explicitly note that copying PDFs alone is not sufficient to migrate an existing Virgilio corpus.

Database provenance/identity and storage contents must remain coherent.

Do not design the migration mechanism yet unless one already exists.

# Processor capabilities

Document processor dependencies as capabilities rather than assuming every extractor must necessarily be mandatory for every installation.

Inspect the current repository and record the actual dependencies for:

```text
pdf_literal_text
pdf_signature_metadata
pdf_structure_inventory
xberg
docling
pdf_ocr_text
```

Distinguish:

* core application requirements;
* cheap/local evidence processor requirements;
* optional/heavy processor requirements;
* unknown/unsettled requirements.

Do not guess executable/package requirements. Inspect the current implementation.

# Capability/readiness concept

Record as a TODO that Virgilio should eventually be able to determine whether configured processors are actually usable on the current machine.

Conceptually:

```text
pdf_literal_text        available
pdf_signature_metadata available
pdf_structure_inventory available
xberg                   available
docling                 unavailable
pdf_ocr_text            unavailable
```

This is a desired readiness capability, not necessarily something to implement in this task.

The eventual check should distinguish, where practical:

```text
installed
configured
executable
version known
usable
```

Do not implement it now.

# Setup automation TODO

Record the likely future goal of a Windows setup entry point such as:

```powershell
.\scripts\setup.ps1
```

Its eventual responsibility may include:

* checking prerequisites;
* installing application dependencies where appropriate;
* creating/configuring local environment files;
* starting required infrastructure;
* bootstrapping the database;
* preparing storage directories;
* preparing frontend dependencies/build;
* validating processor dependencies.

Do not assume that setup.ps1 should automatically install every heavyweight external processor.

That decision remains to be made.

# Environment doctor TODO

Record a separate desired diagnostic entry point such as:

```powershell
.\scripts\doctor.ps1
```

The intended outcome is something conceptually like:

```text
Virgilio environment

Core
  Node.js                  OK
  PostgreSQL               OK
  Directus                 OK
  Database schema          OK
  Canonical storage        OK
  Artifact storage         OK

Processors
  pdftotext                OK
  qpdf                     OK
  Xberg                    OK
  Docling                  unavailable
  OCR                      unavailable

Services
  binary gateway           OK
  consultation API         OK
  consultation UI          OK
```

Exact checks and output are not part of this documentation task.

# Startup TODO

Record the goal of having a simple documented local startup path.

Potentially:

```powershell
npm run start:local
```

or another repository-appropriate command.

Do not invent or implement the command now.

The desired property is that normal application startup should be distinct from starting expensive/background corpus processing.

Starting Virgilio should not unexpectedly launch a large Docling/OCR backlog.

# Database bootstrap

Inspect and document what currently exists for:

* PostgreSQL startup;
* schema initialization;
* migrations;
* Directus initialization;
* canonical corpus import/bootstrap;
* empty-database bootstrap.

Clearly identify any manual or undocumented steps.

Do not fix them in this task.

# Storage portability

Inspect and document the current assumptions around:

```text
file_binary
    -> BinaryStore
    -> canonical binary storage
```

and derived representation/artifact storage.

Record known portability requirements.

In particular, identify any remaining:

* machine-specific absolute paths;
* environment-specific roots;
* assumptions about `data/imports`;
* assumptions about artifact roots;
* paths persisted in PostgreSQL that could prevent moving an installation.

Do not redesign BinaryStore.

If the existing storage abstraction already solves a portability concern, say so.

# Configuration

Inspect and document all currently required environment/configuration inputs needed to run the application.

Identify:

* database connection configuration;
* storage roots;
* service ports;
* Directus configuration;
* processor executable/configuration paths;
* Python/Docling configuration;
* OCR configuration;
* frontend/API proxy assumptions;
* any secrets or credentials.

Do not expose actual secrets in documentation.

Record whether an example environment file exists.

If not, add creation of something like:

```text
.env.example
```

to the TODO rather than implementing it unless it is trivially documentation-only and contains no sensitive values.

# Installation documentation policy

Add an explicit standing repository policy:

> Any change that adds, removes, upgrades, relocates, or materially changes a runtime prerequisite, external executable, service, environment variable, storage requirement, database bootstrap step, processor dependency, or startup procedure must update the setup documentation in the same change.

This policy should cover at least:

* Node/runtime requirements;
* npm dependencies where they affect setup;
* Docker/container requirements;
* PostgreSQL;
* Directus;
* pdftotext;
* qpdf;
* Xberg;
* Python;
* Docling;
* OCR;
* environment variables;
* ports;
* storage locations;
* database bootstrap/migrations;
* startup commands.

The purpose is to prevent:

```text
code works on development machine
```

while:

```text
SETUP.md describes an older system
```

# Source of truth

Establish:

```text
docs/SETUP.md
```

as the eventual operational setup source of truth.

If creating a complete SETUP.md now would imply unsupported installation instructions, do not pretend it is complete.

Instead create a clearly marked initial SETUP.md containing:

* current verified setup knowledge;
* prerequisites known today;
* currently verified startup commands;
* explicit TODO/gaps;
* link/reference to the detailed portability TODO.

Create:

```text
docs/TODO-setup-and-portability.md
```

for unresolved work.

The distinction should be:

```text
SETUP.md
    = what a user/operator can rely on today

TODO-setup-and-portability.md
    = what remains necessary to make setup reproducible/portable
```

Do not put speculative instructions into SETUP.md.

# Definition of deployment readiness

Record an explicit target acceptance test for a future portability milestone:

```text
On a clean supported Windows machine:

1. obtain/clone Virgilio
2. follow SETUP.md
3. satisfy/install required prerequisites
4. bootstrap an empty local instance
5. run environment diagnostics
6. start the application
7. open the consultation UI
8. ingest at least one real PDF
9. run the baseline local evidence processors
10. inspect the original and derived representation in the UI
```

The procedure should not require undocumented developer knowledge.

Heavy processors such as Docling/OCR may be separately enabled if the eventual dependency model treats them as optional capabilities.

# Installer boundary

Explicitly record that an MSI/EXE installer is not currently the immediate goal.

The nearer milestone is:

```text
clone
→ setup
→ doctor
→ start
→ browser
→ ingest/process a PDF
```

Only after that workflow has been validated on another clean machine should the project decide whether a packaged Windows installer is worthwhile.

# Review existing documentation

Search existing architecture/discussion/README/setup documentation before creating the new notes.

Avoid duplicating an existing source of truth.

If a suitable setup document already exists, evolve it rather than creating competing documentation.

Discussion notes are not the operational source of truth.

# No implementation work

This checkpoint is documentation and repository-policy work only.

Do not:

* implement setup.ps1;
* implement doctor.ps1;
* build an installer;
* change Docker configuration;
* upgrade dependencies;
* change Node version;
* install processors;
* modify processing policy;
* run processing jobs;
* change schema;
* change BinaryStore;
* implement migration/export;
* implement capability discovery;
* start Phase D.

# Validation

Review the resulting documentation against the current repository.

Every statement presented as current behavior must be verifiable from the repository.

Clearly label future work as TODO.

Run:

```text
git diff --check
git status --short
```

Review the complete diff.

# Result note

Create a short discussion/result note following the repository's current convention if appropriate.

Record:

* documents created/changed;
* verified current prerequisites;
* known portability blockers;
* known undocumented/manual setup steps;
* processor dependency findings;
* storage portability findings;
* configuration findings;
* setup documentation policy;
* deployment-readiness acceptance target;
* recommended first implementation task for portability.

# Commit

Commit this documentation checkpoint.

Suggested commit message:

```text
Document setup and portability requirements
```

After commit:

```text
git status --short
```

Confirm the working tree is clean.

# Final report

Report:

1. files created/changed;
2. current verified setup path;
3. core prerequisites;
4. processor-specific prerequisites;
5. which processor dependencies appear optional versus mandatory;
6. database/bootstrap findings;
7. storage portability findings;
8. configuration/environment findings;
9. current manual/undocumented steps;
10. contents/purpose of `docs/SETUP.md`;
11. contents/purpose of `docs/TODO-setup-and-portability.md`;
12. exact setup-documentation maintenance policy added;
13. deployment-readiness acceptance test;
14. recommended first portability implementation task;
15. commit hash;
16. commit message;
17. final `git status --short`;
18. confirmation that the working tree is clean.

STOP after this documentation checkpoint.

Do not begin implementing the portability TODOs.
