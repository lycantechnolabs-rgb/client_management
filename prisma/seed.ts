import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { copyFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ACTIVITY_TYPES } from "../src/lib/constants";

const db = new PrismaClient();

const ADMIN_PASSWORD = "Admin@123";
const CLIENT_PASSWORD = "Client@123";

/** Days ago -> Date, at a plausible working hour. */
function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const IMG = (n: number) => `/uploads/estate-${n}.svg`;
const DOC = (n: number) => `/uploads/document-${n}.svg`;
const VIDEO_WALKTHROUGH = "/uploads/estate-walkthrough-june.webm";

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

/**
 * Attachment metadata taken from the file that is actually on disk.
 *
 * These fields are not decoration: the documents page prints the filename and
 * the size to the grower, and the row links straight at the URL. The seed used
 * to hard-code "application/pdf" and a round number of bytes, so a grower saw
 * "Residue-test-report-June.pdf · 332 KB" and got a 10 KB SVG when they tapped
 * it. Deriving all three from the file means they cannot drift apart again —
 * and if these specimens are ever replaced with real PDFs, the extension, the
 * MIME type and the size all follow the new file with no edit here.
 */
const PRIVATE_UPLOADS = join(process.cwd(), "private-uploads");

/**
 * Copy a seed asset into private storage and describe the Attachment row.
 *
 * Client photos and documents are not public files. They live in
 * private-uploads/ and are served only through /api/files/<id>, which checks
 * ownership — so the seed places them the same way a real upload would,
 * rather than leaving them readable to anyone who guesses a path.
 */
function privateAsset(source: string, baseName: string) {
  const ext = source.slice(source.lastIndexOf(".")).toLowerCase();
  const from = join(process.cwd(), "public", source.replace(/^\//, ""));
  const storageKey = `${randomUUID()}${ext}`;

  let sizeBytes: number | null = null;
  try {
    sizeBytes = statSync(from).size;
    copyFileSync(from, join(PRIVATE_UPLOADS, storageKey));
  } catch {
    // Seeding must not fail because an asset is missing; the portal already
    // copes with a null size by omitting it from the row.
    console.warn(`  ! asset missing, size left null: ${source}`);
  }

  return {
    url: "",
    storageKey,
    filename: `${baseName}${ext}`,
    mimeType: MIME[ext] ?? "application/octet-stream",
    sizeBytes,
  };
}

async function main() {
  console.log("Clearing existing data…");
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.productImage.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.auditLog.deleteMany();
  await db.message.deleteMany();
  await db.attachment.deleteMany();
  // Attachment rows are gone, so the bytes they referenced are orphans.
  rmSync(PRIVATE_UPLOADS, { recursive: true, force: true });
  mkdirSync(PRIVATE_UPLOADS, { recursive: true });
  await db.activityWorker.deleteMany();
  await db.material.deleteMany();
  await db.activity.deleteMany();
  await db.worker.deleteMany();
  await db.plot.deleteMany();
  await db.user.deleteMany();
  await db.client.deleteMany();
  await db.activityType.deleteMany();
  await db.setting.deleteMany();

  console.log("Activity types…");
  await db.activityType.createMany({
    data: ACTIVITY_TYPES.map((t, i) => ({
      key: t.key,
      label: t.label,
      icon: t.icon,
      color: t.tone,
      sortOrder: i,
    })),
  });

  console.log("Admin…");
  const adminHash = await hash(ADMIN_PASSWORD);
  const admin = await db.user.create({
    data: {
      name: "Jinto Jomon",
      email: "jinto@aela.co.in",
      phone: "8590657900",
      passwordHash: adminHash,
      role: "ADMIN",
      mustChangePassword: false,
    },
  });

  const clientHash = await hash(CLIENT_PASSWORD);

  console.log("Clients, plots, workers…");

  const seedClients = [
    {
      code: "CLT-001",
      name: "Thomas Mathew",
      phone: "9847012345",
      whatsapp: "9847012345",
      email: "thomas@example.com",
      village: "Vandanmedu",
      address: "Cheruvally House, Vandanmedu P.O.",
      plots: [
        { name: "Cheruvally Estate", location: "Vandanmedu", areaAcres: 4.5, plants: 3200 },
        { name: "Puthenpurayil Plot", location: "Vandanmedu East", areaAcres: 1.8, plants: 1250 },
      ],
      workers: [
        { name: "Rajan K", role: "Supervisor", dailyWage: 900, phone: "9633011223" },
        { name: "Sunitha M", role: "Harvester", dailyWage: 700 },
        { name: "Biju P", role: "Sprayer", dailyWage: 800 },
        { name: "Ravi S", role: "General labour", dailyWage: 650 },
      ],
    },
    {
      code: "CLT-002",
      name: "Rajan Pillai",
      phone: "9847023456",
      whatsapp: "9847023456",
      email: "rajan@example.com",
      village: "Kumily",
      address: "Thekkemala, Kumily P.O.",
      plots: [{ name: "Thekkemala Estate", location: "Kumily", areaAcres: 3.2, plants: 2400 }],
      workers: [
        { name: "Shaji T", role: "Supervisor", dailyWage: 900 },
        { name: "Leela R", role: "Harvester", dailyWage: 700 },
      ],
    },
    {
      code: "CLT-003",
      name: "Mary Joseph",
      phone: "9847034567",
      whatsapp: "9847034567",
      email: "mary@example.com",
      village: "Nedumkandam",
      address: "Kalapurackal, Nedumkandam",
      plots: [
        { name: "Kalapurackal Estate", location: "Nedumkandam", areaAcres: 6.0, plants: 4100 },
        { name: "Hill View Plot", location: "Nedumkandam North", areaAcres: 2.2, plants: 1500 },
      ],
      workers: [
        { name: "Joy Varghese", role: "Supervisor", dailyWage: 950 },
        { name: "Ancy K", role: "Harvester", dailyWage: 700 },
        { name: "Manoj D", role: "General labour", dailyWage: 650 },
      ],
    },
    {
      code: "CLT-004",
      name: "Abdul Rahman",
      phone: "9847045678",
      whatsapp: "9847045678",
      email: "abdul@example.com",
      village: "Puliyanmala",
      address: "Valiyaveettil, Puliyanmala",
      plots: [{ name: "Valiyaveettil Estate", location: "Puliyanmala", areaAcres: 2.8, plants: 1900 }],
      workers: [{ name: "Salim K", role: "General labour", dailyWage: 700 }],
    },
  ];

  const created: {
    id: string;
    name: string;
    plotIds: string[];
    workerIds: string[];
  }[] = [];

  for (const c of seedClients) {
    const client = await db.client.create({
      data: {
        code: c.code,
        name: c.name,
        phone: c.phone,
        whatsapp: c.whatsapp,
        email: c.email,
        address: c.address,
        village: c.village,
        district: "Idukki",
      },
    });

    await db.user.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        passwordHash: clientHash,
        role: "CLIENT",
        clientId: client.id,
        mustChangePassword: false,
      },
    });

    const plotIds: string[] = [];
    for (const p of c.plots) {
      const plot = await db.plot.create({
        data: { ...p, clientId: client.id },
      });
      plotIds.push(plot.id);
    }

    const workerIds: string[] = [];
    for (const w of c.workers) {
      const worker = await db.worker.create({
        data: {
          ...w,
          clientId: client.id,
          plotId: plotIds[0],
          joinedOn: daysAgo(400),
        },
      });
      workerIds.push(worker.id);
    }

    created.push({ id: client.id, name: c.name, plotIds, workerIds });
  }

  console.log("Activities…");

  type Seedable = {
    day: number;
    type: string;
    title: string;
    notes: string;
    labourCount?: number;
    labourCost?: number;
    materialCost?: number;
    otherCost?: number;
    weather?: string;
    harvest?: {
      green: number;
      dried: number;
      grade: string;
      rate: number;
    };
    materials?: {
      name: string;
      category: string;
      quantity: number;
      unit: string;
      cost?: number;
    }[];
    images?: number[];
    /** `name` is the base name — privateAsset appends the real file extension. */
    docs?: {
      n: number;
      name: string;
      category: string;
      caption: string;
    }[];
  };

  // Richest history for client 1 — this is the showcase account.
  const plan: Seedable[] = [
    {
      day: 4,
      type: "FERTILIZER",
      title: "Second round NPK application",
      notes:
        "Applied around the base of each clump, 20 cm from the plant. Soil moisture was good after the rain on Tuesday. Covered the full Cheruvally block.",
      labourCount: 4,
      labourCost: 2900,
      materialCost: 12400,
      weather: "Cloudy, light drizzle",
      materials: [
        { name: "Factomphos 20:20:0:13", category: "FERTILIZER", quantity: 150, unit: "kg", cost: 5400 },
        { name: "Muriate of Potash", category: "FERTILIZER", quantity: 100, unit: "kg", cost: 3800 },
        { name: "Neem cake", category: "FERTILIZER", quantity: 200, unit: "kg", cost: 3200 },
      ],
      images: [1, 2],
    },
    {
      day: 11,
      type: "SPRAYING",
      title: "Thrips control spray",
      notes:
        "Thrips damage noticed on the younger panicles in the lower section. Sprayed the affected block and the two rows on either side as a precaution. Will check again in ten days.",
      labourCount: 2,
      labourCost: 1600,
      materialCost: 3850,
      weather: "Clear",
      materials: [
        { name: "Quinalphos 25 EC", category: "PESTICIDE", quantity: 1.5, unit: "L", cost: 2850 },
        { name: "Sticker / spreader", category: "OTHER", quantity: 250, unit: "ml", cost: 1000 },
      ],
      images: [3],
    },
    {
      day: 19,
      type: "HARVEST",
      title: "Fourth round picking",
      notes:
        "Good round. Capsules well filled, colour holding. Moved straight to the curing house the same evening.",
      labourCount: 6,
      labourCost: 4200,
      weather: "Dry",
      harvest: { green: 420, dried: 84, grade: "AGEB — Alleppey Green Extra Bold", rate: 2150 },
      images: [4, 5],
    },
    {
      day: 21,
      type: "CURING",
      title: "Curing house — batch 4",
      notes:
        "Loaded at 6 pm, held between 50 and 55 °C. Turned twice. Colour came out well, minimal browning.",
      labourCount: 2,
      labourCost: 1400,
      otherCost: 2600,
      images: [6],
    },
    {
      day: 33,
      type: "WEEDING",
      title: "Manual weeding — full block",
      notes: "Slash weeding done. Left the mulch in place between the rows.",
      labourCount: 5,
      labourCost: 3250,
      images: [7],
    },
    {
      day: 41,
      type: "SPRAYING",
      title: "Preventive fungicide — azhukal",
      notes:
        "Monsoon spell coming. Bordeaux mixture applied across the whole estate as a preventive measure against capsule rot.",
      labourCount: 3,
      labourCost: 2400,
      materialCost: 4100,
      materials: [
        { name: "Copper sulphate", category: "FUNGICIDE", quantity: 10, unit: "kg", cost: 2600 },
        { name: "Lime", category: "FUNGICIDE", quantity: 10, unit: "kg", cost: 700 },
        { name: "Bavistin (Carbendazim)", category: "FUNGICIDE", quantity: 500, unit: "g", cost: 800 },
      ],
      images: [8],
      docs: [
        {
          n: 1,
          name: "Residue-test-report-June",
          category: "LAB_REPORT",
          caption: "Residue analysis following the June preventive spray",
        },
      ],
    },
    {
      day: 52,
      type: "HARVEST",
      title: "Third round picking",
      notes: "Slightly lighter round than expected. Rain on picking day slowed the crew.",
      labourCount: 6,
      labourCost: 4200,
      harvest: { green: 355, dried: 71, grade: "AGB — Alleppey Green Bold", rate: 1980 },
      images: [9],
    },
    {
      day: 66,
      type: "SHADE",
      title: "Shade regulation before monsoon",
      notes:
        "Lopped the silver oak on the western side. Aiming for roughly 50 percent filtered light through the season.",
      labourCount: 3,
      labourCost: 2700,
      images: [10],
    },
    {
      day: 78,
      type: "FERTILIZER",
      title: "First round NPK + organic",
      notes: "Pre-monsoon application. Cow dung applied along with the chemical mix.",
      labourCount: 4,
      labourCost: 2800,
      materialCost: 15200,
      materials: [
        { name: "Factomphos 20:20:0:13", category: "FERTILIZER", quantity: 150, unit: "kg", cost: 5400 },
        { name: "Urea", category: "FERTILIZER", quantity: 75, unit: "kg", cost: 1900 },
        { name: "Cow dung (composted)", category: "FERTILIZER", quantity: 40, unit: "bags", cost: 7900 },
      ],
      images: [11],
    },
    {
      day: 94,
      type: "IRRIGATION",
      title: "Sprinkler run — dry spell",
      notes: "Ten days without rain. Ran the sprinklers on alternate days for a week.",
      labourCount: 1,
      labourCost: 900,
      otherCost: 3400,
      images: [12],
    },
    {
      day: 108,
      type: "MULCHING",
      title: "Mulching with dried leaves",
      notes: "Mulch laid around each clump to hold moisture through the dry weeks.",
      labourCount: 4,
      labourCost: 2600,
      images: [1],
    },
    {
      day: 125,
      type: "PLANTING",
      title: "Gap filling — 180 suckers",
      notes:
        "Replaced the plants lost to rot last season. Njallani variety suckers, planted with a handful of rock phosphate each.",
      labourCount: 4,
      labourCost: 3000,
      materialCost: 9600,
      materials: [
        { name: "Njallani suckers", category: "OTHER", quantity: 180, unit: "nos", cost: 9000 },
        { name: "Rock phosphate", category: "FERTILIZER", quantity: 25, unit: "kg", cost: 600 },
      ],
      images: [2, 3],
      docs: [
        {
          n: 2,
          name: "Nursery-invoice-suckers",
          category: "INVOICE",
          caption: "Nursery invoice — 180 Njallani suckers",
        },
      ],
    },
    {
      day: 140,
      type: "INSPECTION",
      title: "Monthly estate inspection",
      notes:
        "Walked the full block with Rajan. Plants healthy overall, a few clumps in the north corner showing yellowing — watching them.",
      labourCount: 1,
      labourCost: 900,
      images: [4],
    },
  ];

  // A lighter history for the other clients.
  const lightPlan: Seedable[] = [
    {
      day: 6,
      type: "FERTILIZER",
      title: "NPK application",
      notes: "Full block covered. Soil moisture good.",
      labourCount: 3,
      labourCost: 2100,
      materialCost: 8600,
      materials: [
        { name: "Factomphos 20:20:0:13", category: "FERTILIZER", quantity: 100, unit: "kg", cost: 3600 },
        { name: "Muriate of Potash", category: "FERTILIZER", quantity: 75, unit: "kg", cost: 2850 },
      ],
      images: [5],
    },
    {
      day: 24,
      type: "HARVEST",
      title: "Second round picking",
      notes: "Steady round, capsules good colour.",
      labourCount: 5,
      labourCost: 3500,
      harvest: { green: 285, dried: 57, grade: "AGB — Alleppey Green Bold", rate: 2010 },
      images: [6, 7],
    },
    {
      day: 45,
      type: "SPRAYING",
      title: "Thrips and borer spray",
      notes: "Routine round, no heavy damage seen.",
      labourCount: 2,
      labourCost: 1500,
      materialCost: 2900,
      materials: [{ name: "Quinalphos 25 EC", category: "PESTICIDE", quantity: 1, unit: "L", cost: 1900 }],
      images: [8],
    },
    {
      day: 72,
      type: "WEEDING",
      title: "Weeding and drain clearing",
      notes: "Drains cleared ahead of the rain.",
      labourCount: 4,
      labourCost: 2600,
      images: [9],
    },
  ];

  async function makeActivities(
    target: (typeof created)[number],
    items: Seedable[],
  ) {
    for (const item of items) {
      const materialCost = item.materialCost ?? 0;
      const labourCost = item.labourCost ?? 0;
      const otherCost = item.otherCost ?? 0;

      const activity = await db.activity.create({
        data: {
          clientId: target.id,
          plotId: target.plotIds[0],
          date: daysAgo(item.day),
          type: item.type,
          title: item.title,
          notes: item.notes,
          labourCount: item.labourCount,
          labourCost,
          materialCost,
          otherCost,
          totalCost: labourCost + materialCost + otherCost,
          weather: item.weather,
          greenWeightKg: item.harvest?.green,
          driedWeightKg: item.harvest?.dried,
          grade: item.harvest?.grade,
          ratePerKg: item.harvest?.rate,
          saleAmount: item.harvest ? item.harvest.dried * item.harvest.rate : undefined,
          createdById: admin.id,
        },
      });

      if (item.materials?.length) {
        await db.material.createMany({
          data: item.materials.map((m) => ({ ...m, activityId: activity.id })),
        });
      }

      if (item.images?.length) {
        await db.attachment.createMany({
          data: item.images.map((n, i) => ({
            clientId: target.id,
            activityId: activity.id,
            plotId: target.plotIds[0],
            kind: "IMAGE",
            ...privateAsset(
              IMG(n),
              `${item.type.toLowerCase()}-${activity.id.slice(-4)}-${i + 1}`,
            ),
            caption: item.title,
          })),
        });
      }

      if (item.docs?.length) {
        await db.attachment.createMany({
          data: item.docs.map((d) => ({
            clientId: target.id,
            activityId: activity.id,
            kind: "DOCUMENT",
            ...privateAsset(DOC(d.n), d.name),
            category: d.category,
            caption: d.caption,
          })),
        });
      }

      // Attach a couple of workers to labour-heavy activities.
      if (item.labourCount && target.workerIds.length) {
        const picked = target.workerIds.slice(0, Math.min(item.labourCount, target.workerIds.length));
        for (const workerId of picked) {
          await db.activityWorker.create({
            data: { activityId: activity.id, workerId, days: 1 },
          });
        }
      }
    }
  }

  await makeActivities(created[0], plan);
  await makeActivities(created[1], lightPlan);
  await makeActivities(created[2], lightPlan.slice(0, 3));
  await makeActivities(created[3], lightPlan.slice(0, 2));

  console.log("A standalone video and a couple of loose documents…");
  await db.attachment.create({
    data: {
      clientId: created[0].id,
      plotId: created[0].plotIds[0],
      kind: "VIDEO",
      // A real, playable file. This row used to point at a poster image while
      // claiming to be a 24.8 MB mp4, so the gallery only "worked" because it
      // was rendering an image — a genuine upload broke the tile.
      ...privateAsset(VIDEO_WALKTHROUGH, "estate-walkthrough-june"),
      caption: "Walkthrough of the Cheruvally block after the second fertilizer round",
    },
  });

  await db.attachment.create({
    data: {
      clientId: created[0].id,
      kind: "DOCUMENT",
      ...privateAsset(DOC(3), "Spice-Board-registration"),
      category: "LICENCE",
      caption: "Spice Board registration copy (specimen)",
    },
  });

  console.log("Messages…");
  await db.message.createMany({
    data: [
      {
        clientId: created[0].id,
        senderUserId: admin.id,
        body: "Thomas chettan, the fourth round is done — 84 kg dried, extra bold. Photos are on the dashboard.",
        createdAt: daysAgo(19, 18),
        readAt: daysAgo(19, 20),
      },
      {
        clientId: created[0].id,
        senderUserId: admin.id,
        body: "Thrips were showing on the lower block, I sprayed on Tuesday. Will check again next week.",
        createdAt: daysAgo(11, 17),
      },
    ],
  });

  console.log("Store products…");

  const products = [
    {
      slug: "alleppey-green-extra-bold",
      name: "Alleppey Green Extra Bold",
      shortDescription: "Our largest, deepest-green capsules. 8 mm and above.",
      description:
        "Hand-picked from estates above 3,000 feet in Idukki and cured slowly to hold colour. Extra bold capsules with a high volatile-oil content and a clean, sweet aroma. The grade we send to our export buyers.",
      grade: "AGEB",
      isFeatured: true,
      sortOrder: 1,
      variants: [
        { label: "100 g", weightGrams: 100, price: 450, stock: 60 },
        { label: "250 g", weightGrams: 250, price: 1050, compareAt: 1125, stock: 40 },
        { label: "500 g", weightGrams: 500, price: 1990, compareAt: 2250, stock: 25 },
      ],
      images: ["/photos/pods-group.webp", "/photos/pod-single.webp"],
    },
    {
      slug: "alleppey-green-bold",
      name: "Alleppey Green Bold",
      shortDescription: "Everyday premium. 7 mm capsules, full aroma.",
      description:
        "The same estates and the same curing, one size down. Bold capsules with all the aroma of our extra bold grade at a friendlier price — what most of our regular households buy.",
      grade: "AGB",
      isFeatured: true,
      sortOrder: 2,
      variants: [
        { label: "100 g", weightGrams: 100, price: 380, stock: 80 },
        { label: "250 g", weightGrams: 250, price: 890, stock: 55 },
        { label: "500 g", weightGrams: 500, price: 1690, compareAt: 1900, stock: 30 },
      ],
      images: ["/photos/pods-bowl.webp"],
    },
    {
      slug: "cardamom-seeds",
      name: "Cardamom Seeds (Decorticated)",
      shortDescription: "Husk removed. Pure seed, for baking and masala.",
      description:
        "Capsules opened and the seed separated by hand. Stronger and more direct than whole pods — a little goes a long way in tea masala, biryani and baking.",
      grade: "Seeds",
      sortOrder: 3,
      variants: [
        { label: "100 g", weightGrams: 100, price: 520, stock: 35 },
        { label: "250 g", weightGrams: 250, price: 1240, stock: 20 },
      ],
      images: ["/uploads/product-4.svg"],
    },
    {
      slug: "ground-cardamom-powder",
      name: "Ground Cardamom Powder",
      shortDescription: "Stone-ground in small batches. Nothing added.",
      description:
        "Ground fresh in small batches so the oil stays in the powder. No fillers, no colour. Keep the pouch closed and use within three months for the best aroma.",
      grade: "Powder",
      sortOrder: 4,
      variants: [
        { label: "50 g", weightGrams: 50, price: 260, stock: 45 },
        { label: "100 g", weightGrams: 100, price: 480, stock: 30 },
      ],
      images: ["/uploads/product-5.svg"],
    },
  ];

  for (const p of products) {
    const { variants, images, ...rest } = p;
    const product = await db.product.create({ data: rest });
    await db.productVariant.createMany({
      data: variants.map((v, i) => ({
        ...v,
        productId: product.id,
        sortOrder: i,
        sku: `CRD-${String(p.sortOrder).padStart(2, "0")}-${v.weightGrams}`,
      })),
    });
    await db.productImage.createMany({
      data: images.map((url, i) => ({
        productId: product.id,
        url,
        alt: p.name,
        sortOrder: i,
      })),
    });
  }

  console.log("A sample order…");
  const ageb = await db.product.findUnique({
    where: { slug: "alleppey-green-extra-bold" },
    include: { variants: true },
  });
  const variant = ageb!.variants.find((v) => v.weightGrams === 250)!;

  await db.order.create({
    data: {
      orderNumber: "CRD-7K3M9Q",
      customerName: "Priya Menon",
      email: "priya@example.com",
      phone: "9846001122",
      addressLine1: "14/B Ashoka Apartments",
      addressLine2: "Panampilly Nagar",
      city: "Kochi",
      state: "Kerala",
      pincode: "682036",
      subtotal: variant.price * 2,
      shippingFee: 0,
      total: variant.price * 2,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentRef: "demo_pay_R7x2Kq",
      items: {
        create: [
          {
            variantId: variant.id,
            productName: ageb!.name,
            variantLabel: variant.label,
            unitPrice: variant.price,
            quantity: 2,
            lineTotal: variant.price * 2,
          },
        ],
      },
    },
  });

  await db.setting.createMany({
    data: [
      { key: "business_name", value: "Cardamom" },
      { key: "contact_phone", value: "8590657900" },
      { key: "contact_email", value: "hello@aela.co.in" },
      { key: "whatsapp", value: "918590657900" },
    ],
  });

  const counts = {
    clients: await db.client.count(),
    plots: await db.plot.count(),
    activities: await db.activity.count(),
    materials: await db.material.count(),
    workers: await db.worker.count(),
    attachments: await db.attachment.count(),
    products: await db.product.count(),
  };

  console.log("\nSeeded:", counts);
  console.log("\n  Admin   jinto@aela.co.in / " + ADMIN_PASSWORD);
  console.log("  Client  thomas@example.com   / " + CLIENT_PASSWORD);
  console.log("  Client  rajan@example.com    / " + CLIENT_PASSWORD + "\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
