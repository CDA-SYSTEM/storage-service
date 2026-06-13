import { Inject, Injectable } from '@nestjs/common';
import { types } from 'cassandra-driver';
import { Client } from 'cassandra-driver';
import { CASSANDRA_CLIENT_TOKEN } from '../constants/storage.constants';
import { FolderEntity } from '../entities/folder.entity';

type FolderRow = {
  id: types.Uuid;
  name: string;
  created_at: Date;
};

@Injectable()
export class FolderRepository {
  constructor(
    @Inject(CASSANDRA_CLIENT_TOKEN) private readonly cassandraClient: Client,
  ) {}

  async create(folder: {
    id: string;
    name: string;
    created_at: Date;
  }): Promise<void> {
    await this.cassandraClient.execute(
      `INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)`,
      [types.Uuid.fromString(folder.id), folder.name, folder.created_at],
      { prepare: true },
    );
  }

  async findAll(search?: string): Promise<FolderEntity[]> {
    const result = await this.cassandraClient.execute(
      `SELECT id, name, created_at FROM folders`,
      [],
      { prepare: true },
    );

    let folders = result.rows.map((row) => {
      const r = row as unknown as FolderRow;
      return {
        id: r.id.toString(),
        name: r.name,
        created_at: r.created_at,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      folders = folders.filter((f) => f.name.toLowerCase().includes(q));
    }

    return folders;
  }

  async findById(id: string): Promise<FolderEntity | null> {
    const result = await this.cassandraClient.execute(
      `SELECT id, name, created_at FROM folders WHERE id = ?`,
      [types.Uuid.fromString(id)],
      { prepare: true },
    );

    const row = result.first() as unknown as FolderRow | null;
    if (!row) return null;

    return {
      id: row.id.toString(),
      name: row.name,
      created_at: row.created_at,
    };
  }

  async deleteById(id: string): Promise<void> {
    await this.cassandraClient.execute(
      `DELETE FROM folders WHERE id = ?`,
      [types.Uuid.fromString(id)],
      { prepare: true },
    );
  }
}
