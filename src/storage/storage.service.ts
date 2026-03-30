import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Client } from 'cassandra-driver';
import { Inject } from '@nestjs/common';
import { CASSANDRA_CLIENT_TOKEN } from './constants/storage.constants';
import { FileEntity } from './entities/file.entity';
import { StorageRepository } from './repositories/storage.repository';
import { UploadFileResponseDto } from './dto/upload-file-response.dto';

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly storageRepository: StorageRepository,
    @Inject(CASSANDRA_CLIENT_TOKEN) private readonly cassandraClient: Client,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.cassandraClient.connect();
    } catch (error) {
      throw new InternalServerErrorException(
        `Cassandra connection failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.cassandraClient.shutdown();
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadFileResponseDto> {
    const id = randomUUID();
    const fileExtension = extname(file.originalname);
    const filename = `${id}${fileExtension}`;
    const createdAt = new Date();

    await this.storageRepository.create({
      id,
      filename,
      original_name: file.originalname,
      mimetype: file.mimetype,
      file_data: file.buffer,
      created_at: createdAt,
    });

    const metadata: FileEntity = {
      id,
      filename,
      original_name: file.originalname,
      mimetype: file.mimetype,
      created_at: createdAt,
      deleted_at: null,
    };

    return {
      file: metadata,
      accessUrl: `/storage/files/${id}`,
    };
  }

  async getFileById(id: string): Promise<FileEntity & { file_data: Buffer }> {
    const file = await this.storageRepository.findById(id);
    if (!file || file.deleted_at) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async listFiles(limit?: number): Promise<FileEntity[]> {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit ?? 100, 1), 500)
      : 100;
    return this.storageRepository.listActiveFiles(normalizedLimit);
  }

  async softDelete(id: string): Promise<void> {
    const file = await this.storageRepository.findById(id);
    if (!file || file.deleted_at) {
      throw new NotFoundException('File not found');
    }

    await this.storageRepository.softDelete(id, new Date());
  }
}
