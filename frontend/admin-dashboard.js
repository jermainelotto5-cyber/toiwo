// Minimal admin JS that uses Supabase JS client (developer: add your supabase client init)
async function init() {
  // TODO: Initialize Supabase client here using your anon key.
  document.getElementById('auth').innerText = 'Admin functionality is available once Supabase client is initialized.'
  document.getElementById('content').style.display = 'block'

  document.getElementById('uploadBtn').onclick = async () => {
    const f = document.getElementById('photoInput').files[0]
    if (!f) return alert('Choose a file')
    alert('Upload flow: please use Supabase Storage SDK to upload and then update site_content or gallery references')
  }

  document.getElementById('importIcal').onclick = async () => {
    const urls = document.getElementById('icals').value.split('\n').map(s=>s.trim()).filter(Boolean)
    if (!urls.length) return alert('Add at least one iCal URL')
    // call Edge Function endpoint (you will deploy it and replace URL)
    const resp = await fetch('/api/calendar-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icals: urls.map(u=>({url:u, sourceName:u})) })
    })
    if (resp.ok) alert('Imported')
    else alert('Error')
  }
}
init()
