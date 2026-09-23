# OREXMINE
## Functional Requirements Document
### Buy-and-Resell Mineral Trading Platform

| Field | Value |
|---|---|
| Document version | 2.1 - Reconciled MVP Scope |
| Supersedes | OREXMINE FRD v2.0 - Buy & Resell Model |
| Prepared for | OREXMINE - Nigeria's Mineral Gateway |
| Business model | OREXMINE purchases minerals from vetted miners and resells them to approved buyers |
| Status | Draft for review |

## 1. Executive Summary

OREXMINE is a controlled B2B mineral trading platform. OREXMINE sources minerals from vetted producers, purchases and takes title to the stock, verifies quality and quantity, stores or aggregates inventory, and resells that inventory to approved buyers under OREXMINE's own commercial terms.

The platform may provide a buyer-facing catalog and ordering experience, but it is **not** a direct miner-to-buyer marketplace. Miners do not transact directly with buyers, and buyers do not contract with miners through the platform. The system must maintain two linked but independently managed transaction legs:

1. **Procurement:** OREXMINE purchases from a vetted miner through a Purchase Order (PO).
2. **Sales:** OREXMINE sells available, quality-approved inventory to a buyer through a Sales Order (SO).

The two legs are connected through inventory batch and traceability records, not through a direct marketplace match.

## 2. Product Definition and Principles

### 2.1 Product definition

The product is an internal operations platform with controlled external portals for miners and buyers. Its core responsibilities are:

- supplier vetting and compliance;
- procurement and purchase-order management;
- delivery receipt, weighing, assay, and quality control;
- inventory custody, reservation, and traceability;
- buyer onboarding, quoting, sales orders, invoicing, and fulfillment;
- miner payouts and buyer payment tracking;
- landed-cost and realized-margin reporting;
- auditable records for every material and financial transaction.

### 2.2 Operating principles

- OREXMINE is the merchant of record for sales to buyers.
- Only active, approved miners may receive purchase offers.
- Only quality-approved, sellable inventory may be offered to buyers.
- Inventory reservations must be atomic and must prevent double-selling.
- Every sellable batch must remain traceable to its originating PO, delivery, miner, assay, and compliance records.
- Financial, quality, compliance, and inventory changes require an audit trail.
- Buyer and miner users may only access their own authorized data.

### 2.3 Product experience

OREXMINE has two connected product surfaces:

- **Buyer mineral showcase:** a visually rich, interactive catalog and batch-detail experience for approved buyers.
- **Operations console:** a dense, workflow-oriented interface for procurement, quality, warehouse, sales, finance, compliance, and administration staff.

The showcase is a presentation and inspection aid, not a substitute for assay, quantity verification, source verification, or commercial controls. A representative 3D model must never be presented as proof of a specific batch's grade, purity, quantity, provenance, or availability. Live inventory facts must come from the transactional API.

## 3. Scope

### 3.1 In scope for the platform

- Miner onboarding, vetting, and documentation.
- Procurement offers, POs, delivery records, and miner payment status.
- Assay, quantity verification, QC decisions, and delivery exceptions.
- Inventory batches, stock movements, storage locations, and reservations.
- Buyer onboarding, KYC approval, quotes, SOs, invoices, and payment status.
- Inbound and outbound logistics records.
- Source verification and shipment documentation.
- Role-based access, audit logging, and operational reporting.

### 3.2 Explicitly out of scope

- Direct miner-to-buyer transactions or matching.
- Public marketing website or CMS.
- General ledger or full accounting system; integrations and references are supported only.
- Native mobile applications; responsive web access is assumed.
- Automated marketplace listings controlled by miners.

## 4. MVP Scope

The MVP must prove one complete, controlled trading cycle from approved miner through paid buyer order. It should initially support one commodity, one operating geography or aggregation route, and a limited number of storage locations. Commodity-specific rules must be configurable rather than hard-coded where practical.

### 4.1 MVP objectives

- Establish a reliable source of vetted mineral supply.
- Receive and verify physical stock before it becomes sellable.
- Sell only available and approved inventory.
- Preserve end-to-end batch traceability.
- Measure landed cost, sales value, cash exposure, and realized margin.
- Create a usable operational record for every exception and approval.

### 4.2 MVP capabilities

| MVP area | Included capability |
|---|---|
| Access control | Staff roles, miner portal access, buyer portal access, and organization-level data visibility |
| Miner onboarding | Registration, document upload, manual vetting score, approval tier, review date, and audit history |
| Procurement | Purchase offer, acceptance, PO creation, partial delivery tracking, PO status, and declared commercial terms |
| Receiving | Delivery record, weighbridge or physical quantity verification, receiving status, and discrepancy capture |
| Quality control | Assay result, declared-versus-tested variance, QC pass/fail decision, certificate upload, and rejection/hold workflow |
| Inventory | Batch/lot record, commodity, grade, quantity, location, sellable status, stock movements, and traceability to source PO(s) |
| Sales | Approved-buyer inventory view, staff-created quote, buyer confirmation, SO creation, reservation, fulfillment status, and invoice record |
| Payments | Miner amount owed and payout status; buyer invoice, payment status, overdue flag, and manual payment reconciliation reference |
| Logistics | Inbound and outbound shipment records, carrier/reference details, dispatch, delivery, and proof-of-delivery upload |
| Compliance | Source verification record, required document checklist, and shipment document pack record |
| Reporting | Procurement, sales, inventory, outstanding payment, and realized-margin reports |
| Audit | Immutable or append-only audit history for POs, SOs, inventory, QC, compliance, and payments |
| Interactive showcase | One pilot commodity, one approved representative 3D model, catalog/detail views, rotate/zoom/pan/reset, inspection view, hotspots, photos, documents, live sellable inventory, quote request, and mobile fallback |
| 3D asset management | Versioned GLB/glTF asset, poster image, metadata, license/provenance, approval status, and publishing controls |

### 4.3 MVP exclusions and later phases

The following are deliberately deferred until the core flow is proven:

- batch pooling and weighted multi-source lots;
- forward or contracted sales;
- online payment-gateway integration;
- automated escrow release;
- benchmark-price feeds and automated dynamic pricing;
- automated SMS, WhatsApp, and email orchestration;
- automated regulatory or cadastral integrations;
- advanced ESG reporting and external framework exports;
- minimum/maximum stock alerts;
- detailed warehouse-cost allocation where it is not required for the initial margin model;
- multi-commodity and multi-country complexity beyond the initial operating route.
- actual batch-specific 3D scanning or photogrammetry;
- AR, WebXR, immersive showroom, or virtual warehouse experiences;
- source maps, provenance timelines, comparative grade visualization, or parametric quantity visualization;
- automated 3D asset ingestion and publishing.

Deferred features must not weaken the MVP's traceability, approvals, payment records, or auditability.

## 5. Users and Roles

| Actor | Responsibilities and access |
|---|---|
| Miner / Supplier | Maintain profile, submit documents and offers, view own POs, upload delivery documents, and view payout status |
| Buyer | Complete KYC, view eligible inventory, request or confirm quotes, view own SOs and invoices, and track fulfillment |
| Procurement Officer | Vet miners, create offers, manage POs, approve procurement exceptions, and monitor supplier performance |
| Trade Desk / Sales Officer | Prepare quotes, set sale prices, confirm buyer orders, reserve stock, and manage sales exceptions |
| Quality / Compliance Officer | Review source records, record assays and quantity checks, make QC decisions, and manage compliance documents |
| Warehouse / Logistics Officer | Receive and locate stock, record movements, coordinate transport, and upload delivery evidence |
| Finance Officer | Record obligations, invoices, receipts, miner payouts, reconciliations, and overdue balances |
| System Administrator | Manage users, roles, configuration, reference data, and system audit access |

Access must be role-based and scoped by organization, transaction, and action. No external user may view another miner's or buyer's commercial data.

## 6. Core Transaction Lifecycle

### 6.1 Procurement lifecycle

`Draft Offer -> Offered -> Accepted -> In Transit -> Received -> QC Hold -> QC Passed or QC Failed -> Payable -> Paid -> Closed`

Rules:

- An offer may only be created for a miner with an active approved tier.
- Acceptance creates a unique PO.
- A PO may have one or more deliveries.
- Each delivery records declared quantity, verified quantity, declared grade, tested grade, and supporting documents.
- Failed or disputed QC stock is not sellable and must be placed on hold, rejected, returned, or otherwise dispositioned by an authorized staff member.
- A PO cannot be closed until its delivery, QC, payment, and exception records are resolved.

### 6.2 Sales lifecycle

`Draft Quote -> Quoted -> Confirmed -> Reserved -> Dispatched -> Delivered -> Invoiced -> Paid -> Closed`

Rules:

- Only approved buyers may confirm an order.
- Only sellable, unreserved inventory may be reserved.
- Reservation must reduce available-to-sell quantity atomically.
- A reservation must have an expiry or an explicit staff-managed hold reason.
- Partial fulfillment must show ordered, reserved, dispatched, delivered, invoiced, and paid quantities separately.
- A SO cannot be closed until fulfillment, invoice, payment, and exception records are resolved.

### 6.3 Ownership and risk records

The system must record, for each PO delivery and SO shipment where applicable:

- title or ownership effective date;
- custody location;
- responsible party while in transit;
- insurance or risk reference;
- delivery and acceptance evidence.

Commercial and legal policy will determine the values. The platform must not assume that physical receipt, QC approval, payment, and title transfer always happen at the same time.

## 7. Functional Requirements

Priority values are **Must**, **Should**, and **Could**. Requirements marked **MVP** are required for the first release.

### 7.1 Miner Vetting and Onboarding

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Capture miner identity, business details, mining title reference, site coordinates, commodity types, and bank details. | Must - MVP |
| FR-02 | Upload and retain mining title, tax clearance, CAC registration, CDA, bank details, assay reports, and other configured documents. | Must - MVP |
| FR-03 | Score Legal Standing, Source Verification, Quality/Quantity, and Reliability using configurable criteria and a 0-2 score per criterion. | Must - MVP |
| FR-04 | Calculate the total score and assign a configurable tier: Preferred, Conditional, Probationary, or Not Onboarded. | Must - MVP |
| FR-05 | Support separate checklists and approval paths for artisanal/small-scale and large-scale/corporate miners. | Must - MVP |
| FR-06 | Set the next review date based on tier and record overdue reviews. | Should - MVP |
| FR-07 | Support an authorized one-tier downgrade after a failed assay, traceability check, or other configured event. | Should |
| FR-08 | Preserve the full history of vetting scores, decisions, documents, and tier changes. | Must - MVP |

### 7.2 Procurement

| ID | Requirement | Priority |
|---|---|---|
| FR-09 | Allow Procurement Officers to create offers specifying commodity, unit, quantity, grade, price, currency, validity, delivery terms, and target location. | Must - MVP |
| FR-10 | Prevent offers to miners without an active approved status. | Must - MVP |
| FR-11 | Generate a unique PO when an offer is accepted. | Must - MVP |
| FR-12 | Track PO state through the procurement lifecycle and record who made each transition. | Must - MVP |
| FR-13 | Support partial deliveries and calculate ordered, delivered, accepted, rejected, and outstanding quantities. | Must - MVP |
| FR-14 | Record short delivery, excess delivery, late delivery, cancellation, and other procurement exceptions. | Must - MVP |
| FR-15 | Show miners their own PO history and payout status. | Should - MVP |

### 7.3 Receiving, Quality, and Assay

| ID | Requirement | Priority |
|---|---|---|
| FR-16 | Record an independent assay for each delivery, including grade, purity, contaminants, laboratory, sample reference, and assay date. | Must - MVP |
| FR-17 | Compare declared and tested grade and calculate configured variance automatically. | Must - MVP |
| FR-18 | Prevent stock from becoming sellable until an authorized user records QC Passed. | Must - MVP |
| FR-19 | Record physical or weighbridge verification, including declared quantity, verified quantity, unit, variance, and evidence. | Must - MVP |
| FR-20 | Store assay certificates, sampling records, receiving records, and QC decisions against the delivery and inventory batch. | Must - MVP |
| FR-21 | Support QC Hold, QC Failed, retest, dispute, reject, return, and approved disposition outcomes. | Must - MVP |

### 7.4 Inventory and Traceability

| ID | Requirement | Priority |
|---|---|---|
| FR-22 | Maintain inventory by commodity, grade, unit, batch/lot number, quantity, status, and storage location. | Must - MVP |
| FR-23 | Maintain available, reserved, dispatched, delivered, rejected, and adjusted quantities separately. | Must - MVP |
| FR-24 | Keep full traceability from every sellable batch to originating delivery, PO, miner, assay, QC decision, and compliance record. | Must - MVP |
| FR-25 | Record timestamped stock movements for receiving, reservation, release, dispatch, delivery, return, adjustment, and write-off. | Must - MVP |
| FR-26 | Prevent negative available inventory and double reservation through transactional controls. | Must - MVP |
| FR-27 | Support pooling of matching deliveries into a sellable lot while preserving source-level traceability. | Should - Phase 2 |
| FR-28 | Configure minimum and maximum stock alerts per commodity and location. | Could - Phase 2 |
| FR-29 | Allocate storage and warehousing costs to inventory batches for landed-cost calculations. | Could - Phase 2 |

### 7.5 Buyer Management

| ID | Requirement | Priority |
|---|---|---|
| FR-30 | Capture buyer identity, business registration, beneficial ownership/KYC details, end-use declaration, address, contacts, and applicable licenses. | Must - MVP |
| FR-31 | Support review, approval, suspension, rejection, and renewal of buyer accounts. | Must - MVP |
| FR-32 | Prevent unapproved or suspended buyers from confirming orders. | Must - MVP |
| FR-33 | Maintain buyer order, invoice, payment, outstanding-balance, and exception history. | Should - MVP |
| FR-34 | Configure buyer credit limits, deposit requirements, or prepayment requirements where applicable. | Should - MVP |

### 7.6 Sales and Order Management

| ID | Requirement | Priority |
|---|---|---|
| FR-35 | Display eligible sellable inventory to approved buyers using configured filters for commodity, grade, quantity, location, and availability. | Must - MVP |
| FR-36 | Allow authorized Trade Desk staff to create a quote with price, currency, quantity, validity, delivery terms, taxes/fees, and payment terms. | Must - MVP |
| FR-37 | Calculate and display expected gross margin using procurement cost and known landed costs before quote confirmation. | Must - MVP |
| FR-38 | Generate a unique SO when a buyer confirms a quote. | Must - MVP |
| FR-39 | Reserve the required inventory atomically against a confirmed SO and prevent double-selling. | Must - MVP |
| FR-40 | Support SO status transitions, partial fulfillment, cancellation, reservation expiry, and approved manual release. | Must - MVP |
| FR-41 | Support spot sales in the MVP. | Must - MVP |
| FR-42 | Support forward or contracted sales with future allocation rules. | Could - Phase 2 |

### 7.7 Pricing, Cost, and Margin

| ID | Requirement | Priority |
|---|---|---|
| FR-43 | Record procurement cost using quantity, unit, currency, grade basis, and commercial terms. | Must - MVP |
| FR-44 | Calculate landed cost from procurement cost plus configured logistics, QC, storage, insurance, tax, and other applicable costs. | Should - MVP |
| FR-45 | Calculate expected margin at quote stage and realized margin after fulfillment using actual cost of goods sold. | Must - MVP |
| FR-46 | Support manual reference-price input to guide quoting. | Could - Phase 2 |
| FR-47 | Preserve the price and cost snapshot used for each confirmed SO so later changes do not rewrite transaction history. | Must - MVP |

### 7.8 Payments and Reconciliation

| ID | Requirement | Priority |
|---|---|---|
| FR-48 | Track amounts owed to miners per PO delivery and record payment status, date, method, amount, and reference. | Must - MVP |
| FR-49 | Support staged miner payout rules, including payment on delivery and balance after QC approval. | Should - MVP |
| FR-50 | Generate buyer invoices from confirmed or fulfilled SOs according to configured billing rules. | Must - MVP |
| FR-51 | Track buyer payment status, partial payments, credits, refunds, and overdue invoices. | Must - MVP |
| FR-52 | Record a general-ledger or external accounting reference for each PO, SO, invoice, receipt, and payout. | Should - MVP |
| FR-53 | Integrate with a payment gateway for buyer collections. | Should - Phase 2 |
| FR-54 | Automate escrow-style release and gateway-based miner payouts. | Should - Phase 2 |

### 7.9 Logistics and Fulfillment

| ID | Requirement | Priority |
|---|---|---|
| FR-55 | Record inbound transport arrangements, origin, destination, carrier, vehicle/reference, expected arrival, and cost. | Should - MVP |
| FR-56 | Record outbound dispatch arrangements, buyer destination, carrier, tracking reference, expected delivery, and cost. | Should - MVP |
| FR-57 | Record dispatch, delivery, proof of delivery, failed delivery, damage, loss, and return outcomes. | Must - MVP |
| FR-58 | Show relevant fulfillment status to Warehouse staff and the affected buyer. | Should - MVP |

### 7.10 Compliance and Documentation

| ID | Requirement | Priority |
|---|---|---|
| FR-59 | Maintain source verification records proving each active batch originated from a vetted, licensed miner. | Must - MVP |
| FR-60 | Generate a configurable document checklist per commodity, route, buyer, and shipment. | Must - MVP |
| FR-61 | Store applicable NMCO references, assay certificates, invoices, waybills, licenses, and delivery evidence in a shipment pack. | Should - MVP |
| FR-62 | Record ESG and responsible-sourcing due diligence per miner and batch. | Should - Phase 2 |
| FR-63 | Apply configurable retention periods and prevent deletion of records subject to legal or audit hold. | Could - Phase 2 |

### 7.11 Reporting and Analytics

| ID | Requirement | Priority |
|---|---|---|
| FR-64 | Provide procurement volume and value by miner, commodity, grade, location, and period. | Must - MVP |
| FR-65 | Provide sales volume and value by buyer, commodity, grade, location, and period. | Must - MVP |
| FR-66 | Provide inventory position by commodity, grade, batch, status, and location. | Must - MVP |
| FR-67 | Provide expected and realized margin by batch, SO, commodity, and period. | Must - MVP |
| FR-68 | Provide outstanding miner obligations, buyer receivables, overdue invoices, and cash exposure. | Must - MVP |
| FR-69 | Provide miner performance using tier, delivery reliability, quantity variance, and QC pass rate. | Should - Phase 2 |
| FR-70 | Provide compliance coverage and source-verification status across active inventory. | Should - MVP |

### 7.12 Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-71 | Notify relevant users of critical PO, QC, inventory, SO, dispatch, invoice, payment, and approval changes. | Should - MVP |
| FR-72 | Support email notifications in the MVP where available. | Should - MVP |
| FR-73 | Support SMS and WhatsApp notifications. | Should - Phase 2 |
| FR-74 | Create staff action queues for pending vetting, QC, document, payment, and delivery actions. | Should - MVP |

### 7.13 Administration and Access Control

| ID | Requirement | Priority |
|---|---|---|
| FR-75 | Enforce role-based access control for all roles in Section 5. | Must - MVP |
| FR-76 | Restrict external users to their own organization, transactions, documents, and payment information. | Must - MVP |
| FR-77 | Maintain an append-only audit log for create, update, approve, reject, reserve, release, dispatch, payment, and delete attempts across critical records. | Must - MVP |
| FR-78 | Require authorization for manual inventory adjustments, QC overrides, price overrides, payment changes, and document deletion attempts. | Must - MVP |
| FR-79 | Allow administrators to configure vetting criteria, thresholds, units, statuses, currencies, document requirements, and retention settings without code changes. | Could - Phase 2 |

### 7.14 Interactive Mineral Showcase and 3D Assets

| ID | Requirement | Priority |
|---|---|---|
| FR-80 | Display only QC-passed, compliant, sellable inventory in buyer-facing showcase results. | Must - MVP |
| FR-81 | Allow approved buyers to filter showcase inventory by commodity, grade, quantity, location, status, and availability according to configured visibility rules. | Must - MVP |
| FR-82 | Provide a mineral detail view with a reusable representative 3D asset, factual batch metadata, photographs, assay records, and permitted compliance documents. | Must - MVP |
| FR-83 | Support rotate, pan, zoom, camera reset, touch interaction, keyboard-accessible controls, and at least one inspection lighting or camera mode. | Must - MVP |
| FR-84 | Support interactive hotspots containing approved descriptive or technical information without implying that visual appearance proves grade, purity, quantity, or provenance. | Should - MVP |
| FR-85 | Display live availability, price, quantity, grade, and status from the transactional API rather than from the 3D asset or a static catalog copy. | Must - MVP |
| FR-86 | Route quote requests and quote confirmations through the existing sales, authorization, and inventory-reservation controls. | Must - MVP |
| FR-87 | Provide a poster-image or standard image fallback when WebGL/WebGPU is unavailable, disabled, unsupported, or unsuitable for the device. | Must - MVP |
| FR-88 | Provide a reduced-quality model or image fallback for supported mobile devices and constrained connections. | Must - MVP |
| FR-89 | Maintain a versioned Mineral Asset record containing model URL, poster URL, commodity, version, license, source/provenance, approval status, and approval date. | Must - MVP |
| FR-90 | Keep reusable 3D asset metadata separate from live batch quantity, grade, QC, compliance, reservation, pricing, and payment data. | Must - MVP |
| FR-91 | Require authorized review and approval before a new or changed 3D asset can be published. | Must - MVP |
| FR-92 | Validate published GLB/glTF assets, record file size and optimization metadata, and preserve prior versions referenced by historical records. | Should - MVP |
| FR-93 | Prevent cached, CDN-served, or pre-rendered showcase content from exposing held, rejected, unapproved, reserved, or unavailable inventory. | Must - MVP |
| FR-94 | Support actual specimen scanning, photogrammetry, batch-specific models, source maps, provenance timelines, AR, and WebXR as later capabilities. | Could - Phase 2 |

## 8. Technical Architecture and Stack

### 8.1 Architecture

The initial product should use a modular monolith with clear domain boundaries rather than separate microservices. The application must expose a transactional API for procurement, QC, inventory, reservations, sales, payments, compliance, and audit events. The interactive showcase consumes approved read models from that API and cannot bypass transactional rules.

The initial architecture consists of:

- responsive web application for the buyer showcase, staff console, miner portal, and buyer portal;
- application API organized around procurement, QC, inventory, sales, payments, compliance, and access control modules;
- transactional relational database for orders, inventory, reservations, financial records, and audit events;
- private object storage for documents, photographs, GLB assets, poster images, and generated variants;
- CDN delivery for approved public-to-the-buyer asset files, using signed or access-controlled URLs where required;
- background workers for document processing, asset validation, image generation, notifications, and reporting jobs;
- centralized authentication, authorization, application logging, and error monitoring.

### 8.2 Recommended stack

| Layer | Recommended technology | Purpose |
|---|---|---|
| Web application | Next.js, React, TypeScript | Buyer showcase, portals, and staff operations console |
| 3D runtime | Three.js, React Three Fiber, and `@react-three/drei` | Interactive GLB/glTF mineral viewing and annotations |
| Motion | Motion or React Spring where required | Camera transitions, staged reveals, and focused interaction feedback |
| Styling | Tailwind CSS plus a domain-specific design system | Responsive UI, accessible states, and consistent visual language |
| Application API | NestJS and TypeScript | Modular business logic, authorization, and transactional workflows |
| Database | PostgreSQL | Orders, batches, reservations, payments, compliance, and audit records |
| Data access | Prisma or Drizzle | Typed database access and migrations |
| Object storage | Amazon S3 or Cloudflare R2 | Documents, models, textures, photos, and posters |
| Delivery | CloudFront or Cloudflare CDN | Efficient, versioned asset delivery with access controls |
| Identity | OIDC-compatible provider such as Auth0, Clerk, or Keycloak | Authentication, organizations, roles, and claims |
| Testing | Vitest, integration tests, and Playwright | Domain behavior, permissions, workflows, and browser coverage |
| Monitoring | Sentry and structured application logs | Error tracking, performance monitoring, and audit diagnostics |

The stack may be changed during implementation if equivalent controls are preserved. A separate game engine such as Unity or Unreal is not required for the MVP.

### 8.3 3D asset production pipeline

The MVP asset pipeline must:

1. Define the pilot commodity and visual reference standard.
2. Gather approved calibrated photographs, macro references, dimensions, and subject-matter review.
3. Create the representative asset and materials in Blender. Substance Painter may be used for texture authoring where appropriate.
4. Export the asset as GLB/glTF with physically based materials.
5. Produce desktop and mobile variants, compressed geometry using Draco or Meshopt, compressed textures using KTX2/Basis where supported, and a WebP poster image.
6. Validate each asset with a glTF validator and browser/device checks.
7. Record license, source/provenance, version, approval owner, approval date, file size, and optimization metadata.
8. Publish immutable versioned files. A new asset version must not rewrite historical transaction or batch references.

Actual specimen scanning and photogrammetry may be introduced later, but the same approval, licensing, versioning, and fallback controls must apply.

## 8. Data Model

The minimum data model must include:

- **Organization/User:** account, role, permissions, contact details, and status.
- **Miner:** profile, licensing, site, commodities, vetting history, documents, tier, and review dates.
- **Buyer:** profile, KYC, end-use, licenses, credit terms, transaction history, and status.
- **Purchase Offer:** commercial proposal from OREXMINE to a miner.
- **Purchase Order:** accepted procurement commitment linked to a miner and one or more deliveries.
- **Delivery/Receipt:** physical delivery linked to a PO, with quantity and custody evidence.
- **Assay/QC Record:** sample, laboratory, results, variance, decision, and supporting files.
- **Inventory Batch/Lot:** commodity, grade, quantity, location, status, cost, and source links.
- **Stock Movement:** immutable movement event with quantity, reason, actor, timestamp, and references.
- **Quote:** sale proposal to a buyer, including price and validity snapshot.
- **Sales Order:** accepted buyer order and its inventory reservations.
- **Shipment/Delivery:** transport, dispatch, proof of delivery, and exceptions.
- **Invoice/Payment:** buyer receivable or miner payable, status, amount, and reconciliation reference.
- **Compliance Record:** source verification, document checklist, shipment pack, and retention status.
- **Audit Event:** actor, timestamp, action, before/after values where appropriate, and reason.
- **Mineral Asset:** reusable 3D model or image asset with commodity, version, model URL, poster URL, license, source/provenance, approval status, approval date, and optimization metadata.
- **Showcase View:** buyer-visible presentation of an approved asset and permitted live inventory data, including filters, factual metadata, photographs, documents, and quote actions.

All quantities must include a unit. All money values must include currency and a defined tax/fee treatment. Commodity-specific grade and purity fields must be extensible.

Mineral Asset records must remain separate from Inventory Batch records. An asset may represent a commodity or specimen shared by multiple batches, while batch quantity, grade, QC, compliance, reservations, pricing, and availability remain live transactional data.

## 9. Business Rules and Exceptions

The MVP must define and test the following rules:

- A miner with expired or failed required documents cannot receive a new offer.
- A buyer with pending or failed KYC cannot confirm a quote.
- QC-failed or QC-held stock cannot appear as available inventory.
- Available quantity equals on-hand sellable quantity less active reservations and other committed quantities.
- Reservation expiry, cancellation, and failed payment must release stock through an audited movement.
- A short or failed delivery must not silently close a PO or SO.
- Every manual adjustment requires a reason, authorized actor, and supporting reference.
- Assay disputes must support retest or independent review without overwriting the original result.
- Price, grade, quantity, cost, and payment changes after approval must create an amendment or adjustment record rather than changing the original history.
- Returned or damaged goods must be quarantined until a new QC or disposition decision is recorded.
- A batch may not be deleted if it has been reserved, dispatched, sold, paid, or referenced by compliance records.

## 10. Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-01 | Encrypt financial, identity, compliance, and authentication data in transit and at rest. | Must |
| NFR-02 | Maintain an append-only or otherwise tamper-evident audit trail for POs, SOs, inventory, QC, compliance, and payments. | Must |
| NFR-03 | Maintain a 99% availability target during standard business hours for internal operations. | Should |
| NFR-04 | Enforce organization- and role-level data isolation for miners, buyers, and staff. | Must |
| NFR-05 | Core inventory, PO, SO, and payment pages should load within 3 seconds under normal MVP load. | Should |
| NFR-06 | Support responsive web access on current desktop and mobile browsers. | Must |
| NFR-07 | Back up transactional data and provide recovery procedures appropriate to financial and compliance records. | Must |
| NFR-08 | Log authentication events, permission failures, exports, and privileged actions. | Must |
| NFR-09 | Support configurable retention and legal hold for compliance and transaction records. | Should |
| NFR-10 | The showcase must provide a usable poster or standard-image fallback when 3D rendering is unavailable or unsuitable. | Must |
| NFR-11 | Published 3D assets must use versioned GLB/glTF files, compressed geometry/textures where supported, and CDN delivery without changing historical references. | Should |
| NFR-12 | The showcase must support current desktop and mobile browsers in the agreed device matrix, including keyboard and touch interaction. | Must |
| NFR-13 | Showcase content must enforce the same organization, buyer approval, inventory status, and document visibility rules as the transactional application. | Must |
| NFR-14 | Asset loading, rendering, fallback, and interactive controls must be covered by browser and visual regression tests on representative desktop and mobile devices. | Should |
| NFR-15 | The initial asset budget, maximum model/texture sizes, and performance thresholds must be documented before production asset creation. | Must |

## 11. MVP Acceptance Criteria

The MVP is ready for pilot use when an authorized team can complete and audit the following scenarios:

1. Register a miner, upload required documents, score the miner, approve a tier, and set a review date.
2. Create and accept a purchase offer, generate a PO, record a partial delivery, and show the outstanding quantity.
3. Record quantity verification and assay results, calculate variance, and prevent failed stock from becoming sellable.
4. Create a sellable batch traceable to its miner, PO, delivery, assay, and source documents.
5. Approve a buyer, issue a quote, confirm an SO, and reserve inventory without allowing a second SO to reserve the same units.
6. Dispatch and deliver a partial order while keeping ordered, reserved, delivered, invoiced, and paid quantities distinct.
7. Record a miner payout and buyer receipt, show outstanding balances, and attach external accounting references.
8. Produce procurement, sales, inventory, receivables/payables, compliance, and margin reports for a selected period.
9. Demonstrate that miners, buyers, and staff users can only access data allowed by their role.
10. Demonstrate an audit history for every approval, QC decision, stock movement, reservation, payment, and manual adjustment.
11. Display an approved representative mineral model for the pilot commodity with working rotate, pan, zoom, reset, touch, keyboard, and inspection controls.
12. Confirm that the showcase displays only QC-passed, compliant, sellable inventory and that live quantity, grade, price, and availability come from the transactional API.
13. Confirm that the model is not used as evidence of batch grade, purity, quantity, provenance, or availability, and that factual metadata links to the appropriate records.
14. Load a mobile or unsupported-device fallback poster, validate a versioned asset, and confirm that a newly published asset does not alter historical asset references.
15. Confirm that buyer and staff permissions apply equally to showcase API responses, cached content, documents, and CDN-served assets.

## 12. Assumptions and Dependencies

- OREXMINE has working capital or approved financing to purchase stock before resale.
- A physical aggregation or storage point is available for the initial pilot route.
- An independent assay capability is available, either in-house or through an accredited partner.
- Regulatory and source-verification data can be accessed manually during MVP if no reliable API exists.
- Commercial policy defines title transfer, payment terms, credit limits, insurance, and risk of loss.
- Legal and compliance advisors define commodity-specific licensing, export, tax, responsible-sourcing, and retention rules.
- The pilot will begin with a constrained commodity and geography so operational controls can be validated before expansion.
- The MVP will use a scientifically grounded representative model rather than an actual 3D scan of every physical batch.
- The buyer showcase will be restricted to approved buyers unless a separate public visibility policy is approved.
- The initial device matrix, asset size budget, visual quality standard, and supported browsers will be agreed before asset production.

## 13. Decisions Required Before Build

The following decisions must be confirmed before implementation is finalized:

- Initial commodity, grade terminology, units, and operating geography.
- Initial aggregation/storage locations and custody model.
- Title, risk, insurance, and payment-transfer points for procurement and sales.
- Assay sampling, retest, dispute, and acceptance policy.
- Buyer payment terms, deposits, credit limits, and delivery release policy.
- Initial tax, fee, currency, and invoice rules.
- Required licenses and document checklist for the pilot commodity and route.
- Reservation expiry and cancellation policy.
- Margin definition: gross margin, contribution margin, and included landed costs.
- External accounting system and reconciliation identifiers.
- Pilot commodity showcase format: representative specimen, concentrate, packaged lot, or another approved visual representation.
- Buyer visibility rules for exact price, quantity, location, source, assay, and compliance details.
- Definition of realistic presentation: scientifically grounded premium presentation versus inspection-level fidelity.
- Initial browser/device support matrix and GLB/texture performance budget.
- Asset approval owner, licensing standard, source/provenance requirements, and version-retention policy.

## 14. Roadmap After MVP

### Phase 2 - Controlled scale

- Additional commodities, routes, and storage locations.
- Batch pooling with weighted average cost and source-level traceability.
- Payment gateway, automated receipts, and escrow-style payout rules.
- Forward and contracted sales with allocation and delivery schedules.
- Benchmark pricing inputs and approval thresholds.
- Automated email, SMS, and WhatsApp notifications.
- Stock-level alerts and detailed warehousing-cost allocation.
- Additional approved mineral assets, model variants, and richer inspection views.
- Actual specimen photography, scanning, or photogrammetry where operationally justified.

### Phase 3 - Compliance and network expansion

- Regulatory and cadastral integrations.
- Expanded ESG and responsible-sourcing workflows.
- Buyer self-service purchasing within approved credit and pricing rules.
- Advanced supplier scoring and predictive procurement analytics.
- Multi-country and export workflow support.
- Batch-specific 3D models, provenance timelines, source and logistics maps, comparative grade visualization, AR, WebXR, and immersive showroom experiences.
- Automated asset ingestion, validation, approval, and publishing workflows.

## 15. Glossary

- **Available inventory:** Sellable on-hand inventory not already reserved or otherwise committed.
- **Batch/Lot:** A traceable quantity of a commodity with defined grade, location, cost, and source records.
- **Landed cost:** Procurement cost plus applicable logistics, QC, storage, insurance, tax, and other acquisition costs.
- **MVP:** The smallest release that proves a complete controlled procurement-to-sale cycle.
- **PO:** Purchase Order from OREXMINE to a miner.
- **QC:** Quality control decision based on assay, quantity verification, documentation, and configured acceptance rules.
- **SO:** Sales Order from OREXMINE to a buyer.
- **Sellable inventory:** Inventory that has passed QC, has required compliance records, and is available for sale.
- **Traceability:** The ability to follow a batch from sale or shipment back to its delivery, PO, miner, assay, and source documents.
