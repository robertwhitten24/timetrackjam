import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import { Resend } from 'npm:resend@3.2.0'
import { jsPDF } from 'npm:jspdf@2.5.2'
import 'npm:jspdf-autotable@3.8.4'
import { format } from 'npm:date-fns@3.3.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid authentication token')
    }

    let body
    try {
      body = await req.json()
    } catch (e) {
      throw new Error('Invalid request body')
    }

    const { to, subject, report } = body

    if (!to) {
      throw new Error('Missing recipient email address')
    }
    if (!subject) {
      throw new Error('Missing email subject')
    }
    if (!report) {
      throw new Error('Missing report data')
    }
    if (!report.clientName || !report.startDate || !report.endDate || !report.projects) {
      throw new Error('Invalid report format')
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('Missing Resend API key')
    }

    const resend = new Resend(resendApiKey)

    // Generate PDF
    const doc = new jsPDF()
    
    // Add logo and title
    doc.setFontSize(20)
    doc.setTextColor(37, 99, 235) // Blue color
    doc.text('Time Report', 20, 20)
    
    // Add client info
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text(`Client: ${report.clientName}`, 20, 35)
    doc.text(`Period: ${format(new Date(report.startDate), 'MMMM d, yyyy')} - ${format(new Date(report.endDate), 'MMMM d, yyyy')}`, 20, 45)
    
    // Add summary
    doc.setFontSize(12)
    doc.text(`Total Hours: ${report.totalHours.toFixed(2)}`, 20, 60)
    doc.text(`Billable Hours: ${report.billableHours.toFixed(2)}`, 20, 70)
    doc.text(`Non-billable Hours: ${report.nonBillableHours.toFixed(2)}`, 20, 80)
    
    // Add project breakdown table
    const tableData = Object.entries(report.projects).map(([project, hours]) => [
      project,
      hours.total.toFixed(2),
      hours.billable.toFixed(2),
      hours.nonBillable.toFixed(2)
    ])
    
    // Add table with styling
    doc.autoTable({
      startY: 90,
      head: [['Project', 'Total Hours', 'Billable Hours', 'Non-billable Hours']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { top: 20 }
    })

    // Generate HTML email content
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Time Report for ${report.clientName}</h2>
            <p>Period: ${format(new Date(report.startDate), 'MMMM d, yyyy')} - ${format(new Date(report.endDate), 'MMMM d, yyyy')}</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Total Hours: ${report.totalHours.toFixed(2)}</h3>
              
              <h4 style="color: #2563eb; margin-bottom: 10px;">Project Breakdown:</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #2563eb; color: white;">
                    <th style="padding: 8px; text-align: left; border-radius: 4px 0 0 4px;">Project</th>
                    <th style="padding: 8px; text-align: right; border-radius: 0 4px 4px 0;">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(report.projects)
                    .map(([project, hours]) => `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px;">${project}</td>
                        <td style="padding: 8px; text-align: right;">${hours.total.toFixed(2)}</td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">
              Best regards,<br>
              TimeFlow
            </p>
          </div>
        </body>
      </html>
    `

    try {
      // Convert PDF to base64
      const pdfBuffer = doc.output('arraybuffer');
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

      // Send the email with PDF attachment
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'TimeFlow <reports@timeflow.app>',
        to: [to],
        subject: subject,
        html: html,
        attachments: [{
          filename: 'time-report.pdf',
          content: pdfBase64
        }]
      });

      if (emailError) {
        throw emailError;
      }

      return new Response(
        JSON.stringify({ success: true, data: emailData }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      )
    } catch (emailError) {
      console.error('Resend error:', emailError)
      throw new Error(`Failed to send email: ${emailError.message}`)
    }
  } catch (error) {
    console.error('Error in send-report function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    )
  }
})