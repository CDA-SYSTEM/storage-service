import { ApiProperty } from '@nestjs/swagger';
import { FolderEntity } from '../entities/folder.entity';

export class FolderResponseDto {
  @ApiProperty({ type: FolderEntity })
  folder!: FolderEntity;
}
