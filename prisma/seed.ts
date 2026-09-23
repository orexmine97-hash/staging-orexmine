// Seed mirroring the OREXMINE prototype's Osun gold pilot dataset.
// Idempotent: clears the transactional tables, then recreates the graph.
//
// Money is stored as integer naira (Decimal(18,2)). The prototype quotes
// prices in ₦-millions per tonne, so m(12.1) => 12_100_000 ₦/t.
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const m = (millionsPerTonne: number) => Math.round(millionsPerTonne * 1_000_000);
const d = (iso: string) => new Date(iso + "T09:00:00Z");
const dec = (n: number) => new Prisma.Decimal(n);

async function reset() {
  // FK-safe order: children first.
  await prisma.auditEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.sourceVerification.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.qcDecision.deleteMany();
  await prisma.assay.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.minerDocument.deleteMany();
  await prisma.mineralAsset.deleteMany();
  await prisma.miner.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function main() {
  // Guard: this seed WIPES all app tables. An empty DB seeds freely (dev
  // convenience); a populated one refuses unless explicitly overridden, so a
  // stray `db seed` can't destroy real staging/prod data.
  const existing = await prisma.organization.count();
  if (existing > 0 && process.env.SEED_ALLOW_RESET !== "1") {
    throw new Error(
      `Refusing to seed: database already has ${existing} organizations and ` +
        `this seed deletes all app tables. Re-run with SEED_ALLOW_RESET=1 only ` +
        `against a DB you know holds throwaway demo data.`,
    );
  }
  await reset();

  // ── OREXMINE org + staff ─────────────────────────────────
  const orex = await prisma.organization.create({
    data: { name: "OREXMINE Ltd", type: "OREXMINE", status: "ACTIVE" },
  });
  const staffSpec = [
    ["admin", "System Admin", "admin@orexmine.ng", "ADMIN"],
    ["procurement", "A. Bello", "a.bello@orexmine.ng", "PROCUREMENT"],
    ["qc", "O. Adeyemi", "o.adeyemi@orexmine.ng", "QUALITY_COMPLIANCE"],
    ["warehouse", "M. Eze", "m.eze@orexmine.ng", "WAREHOUSE_LOGISTICS"],
    ["finance", "T. Oyelaran", "t.oyelaran@orexmine.ng", "FINANCE"],
    ["sales", "Trade Desk", "desk@orexmine.ng", "SALES"],
  ] as const;
  const staff: Record<string, { id: string; name: string }> = {};
  for (const [key, name, email, role] of staffSpec) {
    const u = await prisma.user.create({
      data: { organizationId: orex.id, name, email, role: role as any },
    });
    staff[key] = { id: u.id, name };
  }

  // ── Miners ───────────────────────────────────────────────
  const minerSpec = [
    { ref: "MIN-0031", name: "Osun Alluvial Ltd", tier: "PREFERRED", status: "ACTIVE", site: "Ilesha West, Osun State", rc: "RC 1 204 771", title: "SSML 22 409", cap: 120, scores: [23, 21, 22, 20], bankVerified: true, review: "2027-08-02" },
    { ref: "MIN-0037", name: "Kwara Reef Mining Co", tier: "CONDITIONAL", status: "ACTIVE", site: "Kabba, Kogi State", rc: "RC 1 398 002", title: "SSML 23 776", cap: 80, scores: [21, 20, 21, 18], bankVerified: true, review: "2027-06-19" },
    { ref: "MIN-0042", name: "Ilesha Minerals Cooperative", tier: "PROBATIONARY", status: "ACTIVE", site: "Ilesha East, Osun State", rc: "RC 1 482 907", title: "SSML 24 118", cap: 40, scores: [22, 18, 20, 15], bankVerified: true, review: "2026-10-14" },
    { ref: "MIN-0039", name: "Gbongan Aggregates Ltd", tier: "PROBATIONARY", status: "ACTIVE", site: "Gbongan, Osun State", rc: "RC 1 441 550", title: "SSML 23 981", cap: 30, scores: [19, 16, 18, 14], bankVerified: false, review: "2026-11-28" },
    { ref: "MIN-0044", name: "Zamfara Reclaim Ltd", tier: "NOT_ONBOARDED", status: "SUSPENDED", site: "Anka, Zamfara State", rc: "RC 1 502 118", title: "SSML 24 402", cap: 0, scores: [18, 12, 14, 11], bankVerified: true, review: "2026-09-12" },
  ] as const;
  const miners: Record<string, { id: string; name: string }> = {};
  for (const s of minerSpec) {
    const org = await prisma.organization.create({
      data: { name: s.name, type: "MINER", status: s.status as any },
    });
    await prisma.user.create({
      data: { organizationId: org.id, name: `${s.name} contact`, email: `${s.ref.toLowerCase()}@miner.ng`, role: "MINER" },
    });
    const miner = await prisma.miner.create({
      data: {
        organizationId: org.id, reference: s.ref, miningTitleReference: s.title, rcNumber: s.rc,
        siteDescription: s.site, tier: s.tier as any,
        scoreLegal: s.scores[0], scoreSource: s.scores[1], scoreQuality: s.scores[2], scoreReliability: s.scores[3],
        monthlyCapTonnes: dec(s.cap), bankAccountRef: "••••", bankVerified: s.bankVerified, nextReviewAt: d(s.review),
        documents: {
          create: [
            { name: "CAC registration", state: "ON_FILE" },
            { name: "Mining title certificate", state: s.ref === "MIN-0039" ? "EXPIRED" : "ON_FILE" },
            { name: "Environmental permit", state: s.tier === "PROBATIONARY" || s.status === "SUSPENDED" ? "MISSING" : "ON_FILE" },
          ],
        },
      },
    });
    miners[s.ref] = { id: miner.id, name: s.name };
  }

  // ── Buyers ───────────────────────────────────────────────
  const buyerSpec = [
    { ref: "BUY-0001", name: "Kaduna Metal Refiners", kyc: "APPROVED", credit: m(2500) },
    { ref: "BUY-0002", name: "Tema Metals SARL", kyc: "APPROVED", credit: m(1800) },
    { ref: "BUY-0003", name: "Abuja Assay & Trade", kyc: "PENDING", credit: null },
  ] as const;
  const buyers: Record<string, { id: string; name: string }> = {};
  for (const b of buyerSpec) {
    const org = await prisma.organization.create({
      data: { name: b.name, type: "BUYER", status: b.kyc === "APPROVED" ? "ACTIVE" : "PENDING" },
    });
    const u = await prisma.user.create({
      data: { organizationId: org.id, name: `${b.name} buyer`, email: `${b.ref.toLowerCase()}@buyer.ng`, role: "BUYER" },
    });
    const buyer = await prisma.buyer.create({
      data: {
        organizationId: org.id, reference: b.ref, kycStatus: b.kyc as any,
        endUseDeclaration: "Smelting / refining", creditLimit: b.credit === null ? null : dec(b.credit),
        kycApprovedById: b.kyc === "APPROVED" ? staff.qc.id : null, kycApprovedAt: b.kyc === "APPROVED" ? d("2026-07-04") : null,
      },
    });
    buyers[b.ref] = { id: buyer.id, name: b.name };
    // Track the buyer's login user for audit actor mapping.
    if (b.ref === "BUY-0001") staff.buyerKaduna = { id: u.id, name: "I. Sanusi" };
  }

  // ── Mineral assets (reusable, versioned) ─────────────────
  await prisma.mineralAsset.createMany({
    data: [
      { commodity: "gold", version: "v2", posterUrl: "/assets/gold-v2-poster.webp", modelUrl: "/assets/gold-concentrate-v2.glb", license: "Owned", sourceProvenance: "Commissioned scan, Jun 2026", approvalStatus: "SUPERSEDED", fileSizeBytes: 6_100_000, optimization: { codec: "none", tris: 94000 } },
      { commodity: "tin", version: "v1", posterUrl: "/assets/tin-v1-poster.webp", modelUrl: "/assets/tin-concentrate-v1.glb", license: "Owned", sourceProvenance: "Commissioned scan, Sep 2026", approvalStatus: "PENDING_REVIEW", fileSizeBytes: 3_000_000, optimization: { codec: "Draco", tris: 22000 } },
    ],
  });
  const goldAsset = await prisma.mineralAsset.create({
    data: { commodity: "gold", version: "v3", posterUrl: "/assets/gold-v3-poster.webp", modelUrl: "/assets/gold-concentrate-v3.glb", license: "Owned", sourceProvenance: "Commissioned scan, Aug 2026", approvalStatus: "APPROVED", approvedById: staff.qc.id, approvedAt: d("2026-08-20"), fileSizeBytes: 2_400_000, optimization: { codec: "Draco", tris: 18000 } },
  });

  // ── Purchase orders ──────────────────────────────────────
  const poSpec = [
    { ref: "PO-0231", miner: "MIN-0031", status: "PAYABLE", qty: 60, grade: 84.0, price: 10.2, created: "2026-08-22" },
    { ref: "PO-0229", miner: "MIN-0037", status: "IN_TRANSIT", qty: 40, grade: 80.0, price: 9.9, created: "2026-09-09" },
    { ref: "PO-0228", miner: "MIN-0044", status: "QC_HOLD", qty: 32, grade: 86.0, price: 10.4, created: "2026-09-01" },
    { ref: "PO-0224", miner: "MIN-0037", status: "CLOSED", qty: 240, grade: 82.0, price: 9.8, created: "2026-07-28" },
    { ref: "PO-0233", miner: "MIN-0031", status: "DRAFT", qty: 50, grade: 83.0, price: 10.1, created: "2026-09-17" },
    { ref: "PO-0226", miner: "MIN-0037", status: "CLOSED", qty: 156, grade: 69.0, price: 8.0, created: "2026-08-04" },
    { ref: "PO-0227", miner: "MIN-0037", status: "CLOSED", qty: 142, grade: 55.0, price: 5.5, created: "2026-08-18" },
    { ref: "PO-0230", miner: "MIN-0031", status: "PAYABLE", qty: 25, grade: 42.0, price: 22.9, created: "2026-08-25" },
    { ref: "PO-0219", miner: "MIN-0031", status: "CLOSED", qty: 104, grade: 81.0, price: 9.9, created: "2026-07-24" },
    { ref: "PO-0216", miner: "MIN-0044", status: "QC_FAILED", qty: 55, grade: 78.0, price: 9.4, created: "2026-07-18" },
  ] as const;
  const pos: Record<string, { id: string; commodity: string }> = {};
  for (const p of poSpec) {
    const commodity = p.ref === "PO-0226" ? "tin" : p.ref === "PO-0227" ? "leadzinc" : p.ref === "PO-0230" ? "coltan" : "gold";
    const po = await prisma.purchaseOrder.create({
      data: {
        reference: p.ref, minerId: miners[p.miner].id, status: p.status as any, commodity,
        declaredQuantity: dec(p.qty), declaredGrade: dec(p.grade), unitPrice: dec(m(p.price)),
        deliveryTerms: "Ex-mine, OREXMINE haulage", targetLocation: "Lagos FZ",
        createdById: staff.procurement.id, createdAt: d(p.created),
      },
    });
    pos[p.ref] = { id: po.id, commodity };
  }

  // ── Batches (with their delivery + assay + QC) ───────────
  // [batchNo, grade, qty, avail, resv, disp, rej, loc, status, cost, price, po, del, assay, assayDate, qcDate]
  type B = [string, number, number, number, number, number, number, string, "SELLABLE" | "QC_HOLD" | "QC_FAIL", number, number, string, string, string, string, string | null];
  const batchSpec: B[] = [
    ["OX-GC-2409-014", 86.4, 62.0, 48.0, 14.0, 0, 0, "Lagos FZ · Bay 4", "SELLABLE", 10.42, 12.10, "PO-0231", "DEL-0187", "ASY-0142", "2026-09-01", "2026-09-03"],
    ["OX-GC-2409-011", 82.1, 152.4, 92.4, 24.0, 36.0, 0, "Lagos FZ · Bay 2", "SELLABLE", 10.05, 11.62, "PO-0231", "DEL-0184", "ASY-0139", "2026-08-26", "2026-08-28"],
    ["OX-GC-2408-097", 79.3, 168.2, 128.2, 0, 40.0, 0, "Ilesha depot", "SELLABLE", 9.78, 11.20, "PO-0224", "DEL-0176", "ASY-0131", "2026-08-14", "2026-08-16"],
    ["OX-GC-2408-088", 84.8, 64.0, 40.0, 0, 24.0, 0, "Lagos FZ · Bay 4", "SELLABLE", 10.31, 11.94, "PO-0224", "DEL-0171", "ASY-0128", "2026-08-07", "2026-08-09"],
    ["OX-GC-2407-072", 81.0, 104.0, 104.0, 0, 0, 0, "Lagos FZ · Bay 2", "SELLABLE", 9.94, 11.48, "PO-0219", "DEL-0164", "ASY-0119", "2026-07-24", "2026-07-26"],
    ["OX-GC-2408-093", 78.4, 31.2, 0, 0, 0, 0, "Lagos FZ · Quarantine Q1", "QC_HOLD", 9.60, 11.02, "PO-0228", "DEL-0186", "ASY-0136", "2026-09-11", null],
    ["OX-GC-2407-064", 76.6, 55.0, 0, 0, 0, 55.0, "Lagos FZ · Quarantine Q2", "QC_FAIL", 9.41, 0, "PO-0216", "DEL-0158", "ASY-0112", "2026-07-18", "2026-07-20"],
    ["OX-CS-2409-021", 68.2, 96.0, 74.0, 22.0, 0, 0, "Jos depot · Bay 1", "SELLABLE", 7.90, 9.34, "PO-0226", "DEL-0179", "ASY-0134", "2026-08-29", "2026-08-31"],
    ["OX-CS-2408-016", 71.5, 58.0, 58.0, 0, 0, 0, "Jos depot · Bay 1", "SELLABLE", 8.14, 9.62, "PO-0226", "DEL-0175", "ASY-0130", "2026-08-13", "2026-08-15"],
    ["OX-CT-2409-008", 42.8, 24.0, 18.5, 5.5, 0, 0, "Lagos FZ · Bay 6", "SELLABLE", 22.60, 26.80, "PO-0230", "DEL-0182", "ASY-0138", "2026-08-30", "2026-09-02"],
    ["OX-LZ-2409-005", 55.4, 140.0, 112.0, 28.0, 0, 0, "Lagos FZ · Bay 2", "SELLABLE", 5.42, 6.38, "PO-0227", "DEL-0181", "ASY-0137", "2026-08-27", "2026-08-29"],
  ];
  const batches: Record<string, { id: string }> = {};
  // Every reserved quantity is backed by an ACTIVE reservation (the invariant
  // the sales slice enforces). Refs start at RSV-0071 to match the audit trail.
  const batchResv: Record<string, { id: string }> = {};
  let rsvSeq = 71;
  for (const [no, grade, qty, avail, resv, disp, rej, loc, status, cost, price, poRef, delRef, asyRef, asyDate, qcDate] of batchSpec) {
    const held = Math.max(0, Math.round((qty - avail - resv - disp - rej) * 10) / 10);
    const po = pos[poRef];
    const declaredGrade = poSpec.find((p) => p.ref === poRef)!.grade;

    const delivery = await prisma.delivery.create({
      data: {
        reference: delRef, purchaseOrderId: po.id, status: "VERIFIED",
        declaredQuantity: dec(qty), verifiedQuantity: dec(qty), declaredGrade: dec(declaredGrade),
        custodyLocation: loc, receivedAt: d(asyDate),
      },
    });
    await prisma.assay.create({
      data: {
        reference: asyRef, deliveryId: delivery.id, laboratory: "SGS Nigeria",
        sampleReference: `${delRef}-S1`, testedGrade: dec(grade), assayDate: d(asyDate),
      },
    });
    const decision = status === "SELLABLE" ? "PASS" : status === "QC_HOLD" ? "HOLD" : "FAIL";
    await prisma.qcDecision.create({
      data: {
        deliveryId: delivery.id, decision: decision as any,
        gradeVariance: dec(Math.round((grade - declaredGrade) * 10) / 10),
        reason: decision === "PASS" ? "Tested grade within ±2 pp of declared" : decision === "HOLD" ? "Retest ordered — variance beyond tolerance" : "Rejected — grade far below declared",
        decidedById: staff.qc.id, decidedByName: staff.qc.name, decidedAt: d(qcDate ?? asyDate),
      },
    });
    const batch = await prisma.inventoryBatch.create({
      data: {
        batchNumber: no, commodity: po.commodity, grade: dec(grade), status,
        location: loc, quantity: dec(qty), availableQuantity: dec(avail), reservedQuantity: dec(resv),
        dispatchedQuantity: dec(disp), rejectedQuantity: dec(rej), heldQuantity: dec(held),
        unitCost: dec(m(cost)), unitPrice: price > 0 ? dec(m(price)) : null,
        sourceDeliveryId: delivery.id, mineralAssetId: po.commodity === "gold" ? goldAsset.id : null,
      },
    });
    batches[no] = { id: batch.id };

    // Stock movements: receipt, plus reservation / dispatch where present.
    await prisma.stockMovement.create({
      data: { batchId: batch.id, type: "RECEIVE", quantity: dec(qty), reason: `Received via ${delRef}`, refType: "Delivery", refId: delRef, actorId: staff.warehouse.id, actorName: staff.warehouse.name, createdAt: d(asyDate) },
    });
    if (resv > 0) await prisma.stockMovement.create({ data: { batchId: batch.id, type: "RESERVE", quantity: dec(resv), reason: "Confirmed sales order", actorId: staff.sales.id, actorName: staff.sales.name } });
    if (disp > 0) await prisma.stockMovement.create({ data: { batchId: batch.id, type: "DISPATCH", quantity: dec(disp), reason: "Outbound shipment", actorId: staff.warehouse.id, actorName: staff.warehouse.name } });

    if (resv > 0) {
      const r = await prisma.reservation.create({
        data: { reference: `RSV-${String(rsvSeq++).padStart(4, "0")}`, batchId: batch.id, status: "ACTIVE", quantity: dec(resv), expiresAt: d("2026-09-21"), createdById: staff.sales.id },
      });
      batchResv[no] = { id: r.id };
    }

    if (status === "SELLABLE") {
      await prisma.sourceVerification.create({
        data: { batchId: batch.id, method: "Miner title + waybill cross-check", reference: `${delRef}/SRC`, verifiedById: staff.qc.id, verifiedByName: staff.qc.name, verifiedAt: d(asyDate) },
      });
    }
  }

  // ── Quotes ───────────────────────────────────────────────
  const quoteSpec = [
    { ref: "QTE-0086", buyer: "BUY-0001", batch: "OX-GC-2409-011", qty: 60, status: "CONFIRMED", issued: "2026-09-08", valid: "2026-09-11", price: 11.62, cost: 10.05 },
    { ref: "QTE-0090", buyer: "BUY-0002", batch: "OX-GC-2409-014", qty: 14, status: "CONFIRMED", issued: "2026-09-15", valid: "2026-09-18", price: 12.10, cost: 10.42 },
    { ref: "QTE-0088", buyer: "BUY-0003", batch: "OX-GC-2408-097", qty: 25, status: "EXPIRED", issued: "2026-09-10", valid: "2026-09-13", price: 11.20, cost: 9.78 },
    { ref: "QTE-0091", buyer: "BUY-0002", batch: "OX-GC-2407-072", qty: 45, status: "QUOTED", issued: "2026-09-17", valid: "2026-09-20", price: 11.48, cost: 9.94 },
  ] as const;
  const quotes: Record<string, { id: string }> = {};
  for (const q of quoteSpec) {
    const quote = await prisma.quote.create({
      data: {
        reference: q.ref, buyerId: buyers[q.buyer].id, batchId: batches[q.batch].id, status: q.status as any,
        quantity: dec(q.qty), unitPrice: dec(m(q.price)), unitCostSnapshot: dec(m(q.cost)),
        deliveryTerms: "FOB Lagos", destination: "Kaduna, Nigeria", validUntil: d(q.valid),
        createdById: staff.sales.id, createdAt: d(q.issued),
      },
    });
    quotes[q.ref] = { id: quote.id };
  }

  // ── Sales orders + reservations + shipments + invoices + payments ──
  const soSpec = [
    { ref: "SO-0118", buyer: "BUY-0001", batch: "OX-GC-2408-088", quote: null, ordered: 24, reserved: 0, dispatched: 24, delivered: 24, invoiced: 24, paid: 24, unit: 11.94, status: "CLOSED", confirmed: "2026-08-22", ship: { ref: "SHP-0338", status: "DELIVERED", pod: "Signed 02 Sep 2026" }, inv: { ref: "INV-0207", status: "PAID" } },
    { ref: "SO-0121", buyer: "BUY-0001", batch: "OX-GC-2409-011", quote: "QTE-0086", ordered: 60, reserved: 24, dispatched: 36, delivered: 36, invoiced: 36, paid: 18, unit: 11.62, status: "PARTIAL", confirmed: "2026-09-08", ship: { ref: "SHP-0342", status: "DELIVERED", pod: "Signed 14 Sep 2026" }, inv: { ref: "INV-0219", status: "PART_PAID" } },
    { ref: "SO-0124", buyer: "BUY-0001", batch: "OX-GC-2408-097", quote: null, ordered: 40, reserved: 0, dispatched: 40, delivered: 0, invoiced: 0, paid: 0, unit: 11.20, status: "DELAYED", confirmed: "2026-09-12", ship: { ref: "SHP-0347", status: "HELD", pod: null }, inv: null },
  ] as const;
  for (const o of soSpec) {
    const so = await prisma.salesOrder.create({
      data: {
        reference: o.ref, buyerId: buyers[o.buyer].id, batchId: batches[o.batch].id,
        quoteId: o.quote ? quotes[o.quote].id : null, status: o.status as any,
        orderedQuantity: dec(o.ordered), reservedQuantity: dec(o.reserved), dispatchedQuantity: dec(o.dispatched),
        deliveredQuantity: dec(o.delivered), invoicedQuantity: dec(o.invoiced), paidQuantity: dec(o.paid),
        unitPrice: dec(m(o.unit)), deliveryTerms: "30% deposit · 70% on delivery", destination: "Kaduna, Nigeria",
        confirmedAt: d(o.confirmed), createdById: staff.sales.id, createdAt: d(o.confirmed),
      },
    });
    // Attach the batch's existing reservation to this SO (avoids double-counting).
    if (o.reserved > 0 && batchResv[o.batch]) {
      await prisma.reservation.update({ where: { id: batchResv[o.batch].id }, data: { salesOrderId: so.id } });
    }
    await prisma.shipment.create({
      data: { reference: o.ship.ref, direction: "OUTBOUND", status: o.ship.status as any, salesOrderId: so.id, carrier: "Dangote Haulage", route: "Lagos FZ → Kaduna", trackingRef: `DH-${o.ship.ref.slice(-4)}`, expectedAt: d("2026-09-28"), podReference: o.ship.pod },
    });
    if (o.inv) {
      await prisma.invoice.create({
        data: { reference: o.inv.ref, salesOrderId: so.id, status: o.inv.status as any, amount: dec(m(o.unit) * o.invoiced), amountPaid: dec(m(o.unit) * o.paid), terms: "30% deposit · 70% on delivery", externalRef: `QB-${o.inv.ref}` },
      });
      if (o.paid > 0) {
        await prisma.payment.create({
          data: { reference: `PAY-${o.inv.ref}`, type: "BUYER_RECEIPT", amount: dec(m(o.unit) * o.paid), method: "Bank transfer", externalRef: `QB-${o.inv.ref}`, recordedById: staff.finance.id },
        });
      }
    }
  }

  // (RSV-0071 on OX-GC-2409-014 from QTE-0090 is created in the batch loop.)

  // ── Miner payouts on closed POs ──────────────────────────
  for (const ref of ["PO-0224", "PO-0226", "PO-0227", "PO-0219"]) {
    const p = poSpec.find((x) => x.ref === ref)!;
    await prisma.payment.create({
      data: { reference: `PYT-${ref}`, type: "MINER_PAYOUT", amount: dec(m(p.price) * p.qty), method: "Bank transfer", externalRef: `QB-${ref}`, purchaseOrderId: pos[ref].id, recordedById: staff.finance.id },
    });
  }

  // ── Audit trail (prototype's recent events) ──────────────
  const A = (actorId: string, actorName: string, actorRole: string, action: string, record: string, before: string, after: string, reason: string, at: string) =>
    prisma.auditEvent.create({ data: { actorId, actorName, actorRole: actorRole as any, action, recordType: record.split(" / ")[0].split("-")[0], recordId: record, before, after, reason, createdAt: new Date(at) } });
  await A(staff.qc.id, staff.qc.name, "QUALITY_COMPLIANCE", "QC decision — pass", "DEL-0184 / OX-GC-2409-011", "QC pending", "QC passed · sellable", "Tested grade within ±2 pp of declared", "2026-09-18T09:42:00Z");
  await A(staff.sales.id, staff.sales.name, "SALES", "Reservation created", "RSV-0071 / OX-GC-2409-014", "available 62.0 t", "available 48.0 t · reserved 14.0 t", "Quote QTE-0090 confirmed by Tema Metals SARL", "2026-09-18T09:15:00Z");
  await A(staff.procurement.id, staff.procurement.name, "PROCUREMENT", "Purchase order drafted", "PO-0233 / MIN-0031", "—", "Draft · 50.0 t", "Replenishment for Q4 buyer commitments", "2026-09-17T16:20:00Z");
  await A(staff.qc.id, staff.qc.name, "QUALITY_COMPLIANCE", "Supplier suspended", "MIN-0044", "Provisional", "Suspended", "Grade variance −7.6 pp on DEL-0186, second occurrence", "2026-09-12T11:05:00Z");
  await A(staff.finance.id, staff.finance.name, "FINANCE", "Miner payout released", "PO-0224 / MIN-0037", "Payable", "Paid", "QC passed on both deliveries; invoice reconciled", "2026-09-09T14:12:00Z");
  await A(staff.buyerKaduna.id, staff.buyerKaduna.name, "BUYER", "Quote confirmed", "QTE-0086 / SO-0121", "Quoted", "Confirmed · 60.0 t reserved", "Buyer confirmation", "2026-09-08T10:04:00Z");

  const counts = {
    orgs: await prisma.organization.count(), miners: await prisma.miner.count(), buyers: await prisma.buyer.count(),
    pos: await prisma.purchaseOrder.count(), batches: await prisma.inventoryBatch.count(),
    sellable: await prisma.inventoryBatch.count({ where: { status: "SELLABLE" } }),
    reservations: await prisma.reservation.count(), salesOrders: await prisma.salesOrder.count(), audit: await prisma.auditEvent.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
