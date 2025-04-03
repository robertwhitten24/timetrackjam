import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Run every Sunday at midnight
cron.schedule('0 0 * * 0', async () => {
  try {
    const startDate = format(startOfWeek(new Date()), 'yyyy-MM-dd');
    const endDate = format(endOfWeek(new Date()), 'yyyy-MM-dd');

    // Fetch time entries
    const { data: entries } = await supabase
      .from('time_entries')
      .select(`
        *,
        project:projects(
          name,
          client:clients(name, email)
        )
      `)
      .gte('start_time', startDate)
      .lte('end_time', endDate);

    if (!entries) return;

    // Process entries into reports
    const reports = {};
    entries.forEach((entry) => {
      const clientName = entry.project?.client?.name || 'Unassigned';
      const clientEmail = entry.project?.client?.email || '';
      const projectName = entry.project?.name || 'Unassigned';
      const duration = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 1000 / 60 / 60;

      if (!reports[clientName]) {
        reports[clientName] = {
          clientName,
          clientEmail,
          totalHours: 0,
          projects: {},
        };
      }

      reports[clientName].totalHours += duration;
      reports[clientName].projects[projectName] = (reports[clientName].projects[projectName] || 0) + duration;
    });

    // Send emails using Microsoft Graph
    const graphClient = Client.init({
      authProvider: (done) => {
        // You'll need to implement token acquisition here
        done(null, process.env.MICROSOFT_ACCESS_TOKEN);
      },
    });

    for (const report of Object.values(reports)) {
      if (!report.clientEmail) continue;

      const emailContent = generateEmailContent(report, startDate, endDate);

      await graphClient
        .api('/me/sendMail')
        .post({
          message: {
            subject: `Weekly Time Report (${startDate} - ${endDate})`,
            body: {
              contentType: 'HTML',
              content: emailContent,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: report.clientEmail,
                },
              },
            ],
          },
        });
    }

    console.log('Weekly reports sent successfully');
  } catch (error) {
    console.error('Error sending weekly reports:', error);
  }
});

function generateEmailContent(report, startDate, endDate) {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Weekly Time Report for ${report.clientName}</h2>
        <p>Period: ${format(new Date(startDate), 'MMMM d, yyyy')} - ${format(new Date(endDate), 'MMMM d, yyyy')}</p>
        
        <h3>Total Hours: ${report.totalHours.toFixed(2)}</h3>
        
        <h4>Project Breakdown:</h4>
        <ul>
          ${Object.entries(report.projects)
            .map(([project, hours]) => `<li>${project}: ${hours.toFixed(2)} hours</li>`)
            .join('')}
        </ul>
        
        <p>Best regards,<br>TimeFlow</p>
      </body>
    </html>
  `;
}