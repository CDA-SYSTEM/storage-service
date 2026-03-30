import { ApiProperty } from '@nestjs/swagger';
import { FileEntity } from '../entities/file.entity';

export class UploadFileResponseDto {
  @ApiProperty({ type: FileEntity })
  file!: FileEntity;

  @ApiProperty({ example: '/storage/files/550e8400-e29b-41d4-a716-446655440000' })
  accessUrl!: string;
}
