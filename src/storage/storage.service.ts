import {
  BadRequestException,
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
import { FolderEntity } from './entities/folder.entity';
import { StorageRepository } from './repositories/storage.repository';
import { FolderRepository } from './repositories/folder.repository';
import { UploadFileResponseDto } from './dto/upload-file-response.dto';
import { FolderResponseDto } from './dto/folder-response.dto';

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly storageRepository: StorageRepository,
    private readonly folderRepository: FolderRepository,
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

  async uploadFile(
    file: Express.Multer.File,
    folderId?: string,
  ): Promise<UploadFileResponseDto> {
    const id = randomUUID();
    const fileExtension = extname(file.originalname);
    const filename = `${id}${fileExtension}`;
    const createdAt = new Date();

    if (folderId) {
      const folder = await this.folderRepository.findById(folderId);
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
    }

    await this.storageRepository.create({
      id,
      filename,
      original_name: file.originalname,
      mimetype: file.mimetype,
      file_data: file.buffer,
      folder_id: folderId ?? null,
      created_at: createdAt,
    });

    const metadata: FileEntity = {
      id,
      filename,
      original_name: file.originalname,
      mimetype: file.mimetype,
      folder_id: folderId ?? null,
      created_at: createdAt,
      deleted_at: null,
    };

    return {
      file: metadata,
      accessUrl: `/storage/files/${id}`,
    };
  }

  async createFolder(name: string, parentId?: string | null): Promise<FolderResponseDto> {
    const id = randomUUID();
    const createdAt = new Date();

    if (parentId) {
      const parent = await this.folderRepository.findById(parentId);
      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    await this.folderRepository.create({ id, name, created_at: createdAt, parent_id: parentId ?? null });

    return {
      folder: { id, name, created_at: createdAt, parent_id: parentId ?? null },
    };
  }

  async deleteFolder(id: string): Promise<void> {
    const folder = await this.folderRepository.findById(id);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const children = await this.folderRepository.findByParent(id);
    if (children.length > 0) {
      throw new BadRequestException(
        `Cannot delete folder with ${children.length} subfolder(s). Remove them first.`,
      );
    }

    const files = await this.storageRepository.findByFolderId(id);
    if (files.length > 0) {
      throw new BadRequestException(
        `Cannot delete folder with ${files.length} active file(s). Remove or move files first.`,
      );
    }

    await this.folderRepository.deleteById(id);
  }

  async getFolderContents(parentId: string | null): Promise<Array<FolderEntity | FileEntity & { type: 'folder' | 'file' }>> {
    const folders = await this.folderRepository.findByParent(parentId);
    const files = parentId
      ? await this.storageRepository.findByFolderId(parentId)
      : [];

    const result: Array<any> = [
      ...folders.map((f) => ({ ...f, type: 'folder' as const })),
      ...files.map((f) => ({ ...f, type: 'file' as const })),
    ];

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }

  async listFolders(search?: string): Promise<FolderEntity[]> {
    return this.folderRepository.findAll(search);
  }

  async listFilesByFolder(folderId: string): Promise<FileEntity[]> {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    return this.storageRepository.findByFolderId(folderId);
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

  async getStats() {
    return this.storageRepository.getStats();
  }
}
