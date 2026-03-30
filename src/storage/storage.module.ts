import { Module } from '@nestjs/common';
import { cassandraProvider } from '../shared/database/cassandra.provider';
import { StorageController } from './storage.controller';
import { StorageRepository } from './repositories/storage.repository';
import { StorageService } from './storage.service';

@Module({
  controllers: [StorageController],
  providers: [cassandraProvider, StorageRepository, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
