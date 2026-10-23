// Read-only summary by default. --send dispatches the explicitly requested QR notice.
import { createClient } from '@supabase/supabase-js';
import { processSchoolQrEmails } from '../lib/panels/school-qr-delivery.ts';
const db=createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const event=await db.from('events').select('id').eq('is_current',true).single();
if(event.error) throw new Error('Current event unavailable');
const rows=await db.from('school_booking_email_deliveries').select('state,school_bookings!inner(event_id)').eq('school_bookings.event_id',event.data.id);
if(rows.error) throw new Error('School email queue unavailable; apply the migration first');
console.log('Queue:',rows.data.reduce((counts,row)=>({...counts,[row.state]:(counts[row.state]||0)+1}),{}));
if(process.argv.includes('--send')) {
 let total=0;
 for(;;) {
  const counts=await processSchoolQrEmails(db,process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL);
  const processed=Object.values(counts).reduce((a,b)=>a+b,0);total+=processed;
  console.log('Batch:',counts);
  if(!processed)break;
 }
 console.log('Processed:',total);
}
