const FIREBASE_URL = 'https://baby-tracker-52e95-default-rtdb.firebaseio.com';

async function fbRequest(method, path, body) {
  const url = `${FIREBASE_URL}/${path}.json`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Firebase ${method} failed: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const data = await fbRequest('GET', 'records');
      const records = data
        ? Object.entries(data).map(([id, val]) => ({ id, ...val }))
        : [];
      res.status(200).json({ records });

    } else if (req.method === 'POST') {
      const { records: clientRecs } = req.body;
      const fbData = await fbRequest('GET', 'records');
      const fbRecs = fbData
        ? Object.entries(fbData).map(([id, val]) => ({ id, ...val }))
        : [];
      const map = {};
      fbRecs.forEach(r => { map[r.id] = r; });
      clientRecs.forEach(r => { map[r.id] = r; });
      const merged = Object.values(map);
      const fbObj = {};
      merged.forEach(r => { const { id, ...rest } = r; fbObj[id] = rest; });
      await fbRequest('PUT', 'records', fbObj);
      res.status(200).json({ records: merged });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
