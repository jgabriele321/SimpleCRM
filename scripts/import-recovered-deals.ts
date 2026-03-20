import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Recovered deals from browser localStorage fragments
const recoveredDeals = [
  {
    title: "PR software",
    personName: "Lexi Mills",
    companyName: "Shift 6",
    stage: "closed_won",
    priority: "high",
    closeProbability: 100,
    expectedValue: 6000,
    tags: [],
    notes: "",
    nextAction: "",
    nextActionDate: null,
  },
  {
    title: "Enterprise Documentation Checker",
    personName: "Joe King",
    companyName: "",
    stage: "active_convo",
    priority: "high",
    closeProbability: 50,
    expectedValue: 25000,
    tags: [],
    notes: "",
    nextAction: "See if he needs help or any materials",
    nextActionDate: new Date("2026-02-07"),
  },
  {
    title: "Accounting AI Solution",
    personName: "Aaron",
    companyName: "Crane and Holtzman",
    stage: "active_convo", // defaulting since blank
    priority: "medium",
    closeProbability: 80,
    expectedValue: 4000,
    tags: [],
    notes: "",
    nextAction: "Schedule time to chat with him",
    nextActionDate: new Date("2026-03-20"),
  },
  {
    title: "Physical Therapy Tech",
    personName: "Dside",
    companyName: "",
    stage: "active_convo",
    priority: "medium", // defaulting since blank
    closeProbability: 20,
    expectedValue: 5000,
    tags: [],
    notes: "Need to connect with Stephanie to get feedback on his device.",
    nextAction: "",
    nextActionDate: null,
  },
  {
    title: "Cayman Island Partnership",
    personName: "Daniel",
    companyName: "Lemma",
    stage: "signal", // defaulting since blank
    priority: "medium", // defaulting since blank
    closeProbability: 50,
    expectedValue: 5000,
    tags: [],
    notes: "",
    nextAction: "Reach out",
    nextActionDate: null,
  },
  {
    title: "Law firm",
    personName: "Mike",
    companyName: "",
    stage: "signal",
    priority: "medium", // defaulting since blank
    closeProbability: 20,
    expectedValue: 10000,
    tags: [],
    notes: "",
    nextAction: "text him",
    nextActionDate: null,
  },
  {
    title: "Doctor Office automation",
    personName: "",
    companyName: "",
    stage: "signal", // defaulting since blank
    priority: "medium", // defaulting since blank
    closeProbability: 20,
    expectedValue: 10000,
    tags: [],
    notes: "",
    nextAction: "",
    nextActionDate: new Date("2025-01-30"),
  },
  {
    title: "Pharma Insights Tool",
    personName: "Crystal Smotrinsky",
    companyName: "",
    stage: "active_convo", // defaulting since blank
    priority: "medium", // defaulting since blank
    closeProbability: 60,
    expectedValue: 10000,
    tags: [],
    notes: "",
    nextAction: "",
    nextActionDate: null,
  },
  {
    title: "ESPN",
    personName: "Kyser",
    companyName: "ESPN",
    stage: "signal", // defaulting since blank
    priority: "medium", // defaulting since blank
    closeProbability: 30,
    expectedValue: 50000,
    tags: [],
    notes: "",
    nextAction: "",
    nextActionDate: null,
  },
  {
    title: "Survey writing automation",
    personName: "",
    companyName: "",
    stage: "proposal_sent",
    priority: "medium", // defaulting since blank
    closeProbability: 50, // defaulting since blank
    expectedValue: 50000,
    tags: [],
    notes: "",
    nextAction: "",
    nextActionDate: null,
  },
];

async function importDeals() {
  console.log("🔄 Starting deal import...\n");

  for (const deal of recoveredDeals) {
    try {
      const created = await prisma.deal.create({
        data: {
          title: deal.title,
          personName: deal.personName || null,
          companyName: deal.companyName || null,
          stage: deal.stage,
          priority: deal.priority,
          closeProbability: deal.closeProbability,
          expectedValue: deal.expectedValue,
          tags: JSON.stringify(deal.tags),
          notes: deal.notes || null,
          nextAction: deal.nextAction || null,
          nextActionDate: deal.nextActionDate,
          lastContactDate: new Date(),
        },
      });
      console.log(`✅ Imported: ${deal.title} (ID: ${created.id})`);
    } catch (error) {
      console.error(`❌ Failed to import: ${deal.title}`, error);
    }
  }

  console.log("\n🎉 Import complete!");
  
  // Show summary
  const totalDeals = await prisma.deal.count();
  console.log(`\n📊 Total deals in database: ${totalDeals}`);
}

importDeals()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

