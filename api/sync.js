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
      const [data, deletedData] = await Promise.all([
        fbRequest('GET', 'records'),
        fbRequest('GET', 'deleted')
      ]);
      const records = data
        ? Object.entries(data).map(([id, val]) => ({ id, ...val }))
        : [];
      const deleted = deletedData ? Object.keys(deletedData) : [];
      res.status(200).json({ records, deleted });

    } else if (req.method === 'POST') {
      const { records: clientRecs, deleted: clientDeleted } = req.body;

      const fbDeletedData = await fbRequest('GET', 'deleted');
      const fbDeleted = fbDeletedData ? Object.keys(fbDeletedData) : [];
      const allDeleted = [...new Set([...fbDeleted, ...(clientDeleted || [])])];

      if (allDeleted.length > 0) {
        const deletedObj = {};
        allDeleted.forEach(id => { deletedObj[id] = true; });
        await fbRequest('PUT', 'deleted', deletedObj);
      }

      const fbData = await fbRequest('GET', 'records');
      const fbRecs = fbData
        ? Object.entries(fbData).map(([id, val]) => ({ id, ...val }))
        : [];

      const map = {};
      fbRecs.forEach(r => { map[r.id] = r; });
      clientRecs.forEach(r => { map[r.id] = r; });
      allDeleted.forEach(id => { delete map[id]; });
      const merged = Object.values(map);

      const fbObj = {};
      merged.forEach(r => { const { id, ...rest } = r; fbObj[id] = rest; });
      await fbRequest('PUT', 'records', fbObj);

      res.status(200).json({ records: merged, deleted: allDeleted });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
