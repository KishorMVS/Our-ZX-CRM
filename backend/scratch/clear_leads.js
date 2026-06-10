const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting deletion process...');
  
  try {
    // Delete dependent records
    const activityCount = await prisma.activity.deleteMany({});
    console.log(`Deleted ${activityCount.count} activities`);
    
    const noteCount = await prisma.note.deleteMany({});
    console.log(`Deleted ${noteCount.count} notes`);
    
    // Task relates to TaskFile and TaskComment which cascade
    const taskCount = await prisma.task.deleteMany({});
    console.log(`Deleted ${taskCount.count} tasks`);
    
    const reminderCount = await prisma.reminder.deleteMany({});
    console.log(`Deleted ${reminderCount.count} reminders`);
    
    const commissionCount = await prisma.commission.deleteMany({});
    console.log(`Deleted ${commissionCount.count} commissions`);
    
    const callLogCount = await prisma.callLog.deleteMany({});
    console.log(`Deleted ${callLogCount.count} call logs`);
    
    const callyzerCount = await prisma.callyzerCall.deleteMany({});
    console.log(`Deleted ${callyzerCount.count} callyzer calls`);

    // Finally delete leads
    const leadCount = await prisma.lead.deleteMany({});
    console.log(`Successfully deleted ${leadCount.count} leads.`);
  } catch (error) {
    console.error('Error during deletion:', error);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
