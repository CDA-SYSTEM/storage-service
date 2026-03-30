import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'cassandra-driver';

function loadDotEnvFile(envFilePath) {
  return readFile(envFilePath, 'utf8')
    .then((content) => {
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
          continue;
        }
        const idx = line.indexOf('=');
        if (idx === -1) {
          continue;
        }
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
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
    replicationFactor: Number(process.env.CASSANDRA_REPLICATION_FACTOR ?? 1),
    username: process.env.CASSANDRA_USERNAME ?? 'cassandra',
    password: process.env.CASSANDRA_PASSWORD ?? 'cassandra',
  };
}

function splitCqlStatements(sql) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function run() {
  await loadDotEnvFile('.env');
  const config = getConfig();

  const adminClient = new Client({
    contactPoints: config.contactPoints,
    localDataCenter: config.localDataCenter,
    protocolOptions: { port: config.port },
    credentials: {
      username: config.username,
      password: config.password,
    },
  });

  await adminClient.connect();
  try {
    await adminClient.execute(
      `CREATE KEYSPACE IF NOT EXISTS ${config.keyspace}
       WITH replication = {'class': 'SimpleStrategy', 'replication_factor': ${config.replicationFactor}}`,
    );
  } finally {
    await adminClient.shutdown();
  }

  const client = new Client({
    contactPoints: config.contactPoints,
    localDataCenter: config.localDataCenter,
    keyspace: config.keyspace,
    protocolOptions: { port: config.port },
    credentials: {
      username: config.username,
      password: config.password,
    },
  });

  await client.connect();
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamp
      )
    `);

    const appliedRows = await client.execute(
      'SELECT version FROM schema_migrations',
      [],
      { prepare: true },
    );
    const appliedVersions = new Set(
      appliedRows.rows.map((row) => String(row.version)),
    );

    const migrationsDir = join(process.cwd(), 'db', 'migrations');
    const migrationFiles = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.cql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      const version = migrationFile;
      if (appliedVersions.has(version)) {
        continue;
      }

      const migrationPath = join(migrationsDir, migrationFile);
      const content = await readFile(migrationPath, 'utf8');
      const statements = splitCqlStatements(content);

      for (const statement of statements) {
        await client.execute(statement);
      }

      await client.execute(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [version, new Date()],
        { prepare: true },
      );
      // eslint-disable-next-line no-console
      console.log(`Applied migration: ${version}`);
    }
  } finally {
    await client.shutdown();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Migration error:', error);
  process.exit(1);
});
