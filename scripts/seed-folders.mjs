import { readFile } from 'node:fs/promises';
import { Client } from 'cassandra-driver';
import { randomUUID } from 'node:crypto';

function loadDotEnvFile(envFilePath) {
  return readFile(envFilePath, 'utf8')
    .then((content) => {
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    })
    .catch(() => undefined);
}

function getConfig() {
  const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS ?? '127.0.0.1')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    contactPoints,
    port: Number(process.env.CASSANDRA_PORT ?? 9042),
    localDataCenter: process.env.CASSANDRA_LOCAL_DATA_CENTER ?? 'datacenter1',
    keyspace: process.env.CASSANDRA_KEYSPACE ?? 'storage',
    username: process.env.CASSANDRA_USERNAME ?? 'cassandra',
    password: process.env.CASSANDRA_PASSWORD ?? 'cassandra',
  };
}

const FOLDERS = [
  { name: 'facturas' },
  { name: 'contratos' },
  { name: 'fotos' },
  { name: 'documentos' },
  { name: '/'}
];

async function run() {
  await loadDotEnvFile('.env');
  const config = getConfig();

  const client = new Client({
    contactPoints: config.contactPoints,
    localDataCenter: config.localDataCenter,
    keyspace: config.keyspace,
    protocolOptions: { port: config.port },
    credentials: { username: config.username, password: config.password },
  });

  await client.connect();
  try {
    for (const folder of FOLDERS) {
      const id = randomUUID();
      const createdAt = new Date();
      await client.execute(
        'INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)',
        [id, folder.name, createdAt],
        { prepare: true },
      );
      console.log(`Seeded folder: ${folder.name} (${id})`);
    }
    console.log('Seed completed successfully');
  } finally {
    await client.shutdown();
  }
}

run().catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
