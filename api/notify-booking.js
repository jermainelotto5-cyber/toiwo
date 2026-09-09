const ENDPOINT = 'https://api.resend.com/emails';
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
const bodyOf = b => typeof b === 'string' ? JSON.parse(b) : (b || {});
async function send(to, from, subject, html, text) {
  const r = await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html,text})});
  const t = await r.text(); let j; try { j=JSON.parse(t); } catch { j={error:t}; }
  if (!r.ok) throw new Error(j.message || j.error || 'Resend request failed');
}
module.exports = async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  let b; try { b=bodyOf(req.body); } catch { return res.status(400).json({error:'Invalid JSON'}); }
  const required=['guest_name','guest_email','check_in','check_out','num_guests'];
  if (required.some(k=>!b[k])) return res.status(400).json({error:'Missing booking notification fields'});
  const key=process.env.RESEND_API_KEY, from=process.env.RESEND_FROM_EMAIL || 'Toiwo Residence <onboarding@resend.dev>', host=process.env.HOST_ADMIN_EMAIL || 'jessicalotto9@gmail.com', beep=process.env.BEEPMATE_ROUTING_EMAIL;
  const lines=['NEW TOIWO RESIDENCE BOOKING','- Guest: '+b.guest_name,'- Email: '+b.guest_email,'- Phone/WhatsApp: '+(b.guest_phone || 'Not provided'),'- Check-in: '+b.check_in,'- Check-out: '+b.check_out,'- Guests: '+b.num_guests,'- Total: $'+Number(b.total_price||0).toFixed(2),'- Booking reference: '+(b.id || 'Pending')];
  const text=lines.join('\n'), html='<h2>New Toiwo Residence booking</h2><ul>'+lines.slice(1).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
  const sent=[], errors=[]; if(!key) errors.push('RESEND_API_KEY is not configured'); if(!beep) errors.push('BEEPMATE_ROUTING_EMAIL is not configured');
  if(key) for(const m of [
    {n:'customer',to:b.guest_email,s:'Toiwo Residence - Reservation received',h:'<h2>Thank you, '+esc(b.guest_name)+'!</h2><p>Your reservation request has been received.</p>'+html,t:'Thank you, '+b.guest_name+'. Your reservation request was received.\n\n'+text},
    {n:'host',to:host,s:'New Booking Alert - '+b.check_in+' to '+b.check_out,h:html,t:text},
    ...(beep?[{n:'beepmate',to:beep,s:'New Booking Summary - '+b.check_in+' to '+b.check_out,h:'<pre>'+esc(text)+'</pre>',t:text}]:[])
  ]) { try { await send(m.to,from,m.s,m.h,m.t); sent.push(m.n); } catch(e) { errors.push(m.n+': '+e.message); } }
  return res.status(200).json({success:errors.length===0,sent,errors});
};
