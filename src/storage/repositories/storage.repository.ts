import { Inject, Injectable } from '@nestjs/common';
import { types } from 'cassandra-driver';
import { Client } from 'cassandra-driver';
import { CASSANDRA_CLIENT_TOKEN } from '../constants/storage.constants';
import { FileEntity } from '../entities/file.entity';

type FileRow = {
  id: types.Uuid;
  filename: string;
  original_name: string;
  mimetype: string;
  file_data: Buffer;
  created_at: Date;
  deleted_at: Date | null;
};

@Injectable()
export class StorageRepository {
  constructor(
    @Inject(CASSANDRA_CLIENT_TOKEN) private readonly cassandraClient: Client,
  ) {}

  async create(file: {
    id: string;
    filename: string;
    original_name: string;
    mimetype: string;
    file_data: Buffer;
    created_at: Date;
  }): Promise<void> {
    await this.cassandraClient.execute(
      `
      INSERT INTO files (id, filename, original_name, mimetype, file_data, created_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        types.Uuid.fromString(file.id),
        file.filename,
        file.original_name,
        file.mimetype,
        file.file_data,
        file.created_at,
        null,
      ],
      { prepare: true },
    );
  }

  async findById(id: string): Promise<(FileEntity & { file_data: Buffer }) | null> {
    const result = await this.cassandraClient.execute(
      `
      SELECT id, filename, original_name, mimetype, file_data, created_at, deleted_at
      FROM files
      WHERE id = ?
      `,
      [types.Uuid.fromString(id)],
      { prepare: true },
    );

    const row = result.first() as unknown as FileRow | null;
    if (!row) {
      return null;
    }

    return {
      id: row.id.toString(),
      filename: row.filename,
      original_name: row.original_name,
      mimetype: row.mimetype,
      file_data: row.file_data,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    };
  }

  async listActiveFiles(limit: number): Promise<FileEntity[]> {
    const result = await this.cassandraClient.execute(
      `
      SELECT id, filename, original_name, mimetype, created_at, deleted_at
      FROM files
      LIMIT ?
      `,
      [limit],
      { prepare: true },
    );

    return result.rows
      .map((row) => row as unknown as Omit<FileRow, 'file_data'>)
      .filter((row) => !row.deleted_at)
      .map((row) => ({
        id: row.id.toString(),
        filename: row.filename,
        original_name: row.original_name,
        mimetype: row.mimetype,
        created_at: row.created_at,
        deleted_at: row.deleted_at,
      }));
  }

  async softDelete(id: string, deletedAt: Date): Promise<void> {
    await this.cassandraClient.execute(
      `
      UPDATE files
      SET deleted_at = ?
      WHERE id = ?
      `,
      [deletedAt, types.Uuid.fromString(id)],
      { prepare: true },
    );
  }

  async getStats(): Promise<{
    totalFiles: number;
    activeFiles: number;
    totalSizeBytes: number;
    filesByMimetype: Array<{ mimetype: string; count: number }>;
    recentUploads: number;
  }> {
    const result = await this.cassandraClient.execute(
      `SELECT id, mimetype, file_data, created_at, deleted_at FROM files ALLOW FILTERING`,
      [],
      { prepare: true },
    );

    const rows = result.rows as any[];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalFiles = 0;
    let activeFiles = 0;
    let totalSizeBytes = 0;
    const mimetypeMap = new Map<string, number>();
    let recentUploads = 0;

    for (const row of rows) {
      totalFiles++;
      if (!row.deleted_at) {
        activeFiles++;
      }
      if (row.file_data) {
        totalSizeBytes += Buffer.from(row.file_data).length;
      }
      const mime = row.mimetype || 'unknown';
      mimetypeMap.set(mime, (mimetypeMap.get(mime) || 0) + 1);
      if (row.created_at) {
        const created = new Date(row.created_at);
        if (created >= todayStart) {
          recentUploads++;
        }
      }
    }

    const filesByMimetype = Array.from(mimetypeMap.entries()).map(([mimetype, count]) => ({
      mimetype,
      count,
    }));

    return {
      totalFiles,
      activeFiles,
      totalSizeBytes,
      filesByMimetype,
      recentUploads,
    };
  }
}
